from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[4]


def load_module(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


acquire = load_module(
    "wenzhou_acquire_fes2022b",
    "projects/wenzhou/coastal/scripts/acquire_fes2022b_native.py",
)
build = load_module(
    "wenzhou_build_fes2022b",
    "projects/wenzhou/coastal/scripts/build_fes2022b_tides.py",
)


class Fes2022bReceiverTests(unittest.TestCase):
    def make_native_fixture(self, path: Path) -> None:
        import netCDF4
        import numpy as np

        with netCDF4.Dataset(path, "w", format="NETCDF4") as dataset:
            dataset.createDimension("coordinate", 4)
            dataset.createDimension("triangle", 2)
            dataset.createDimension("vertex3", 3)
            dataset.createDimension("vertex6", 6)
            dataset.createDimension("lgp2_node", 12)
            dataset.title = "FES2022b ocean tide structural test fixture"
            dataset.discretization = "official test evidence LGP2"
            longitude = dataset.createVariable("mesh_lon", "f8", ("coordinate",))
            latitude = dataset.createVariable("mesh_lat", "f8", ("coordinate",))
            longitude.standard_name = "longitude"
            latitude.standard_name = "latitude"
            longitude[:] = [0.0, 1.0, 0.0, 1.0]
            latitude[:] = [0.0, 0.0, 1.0, 1.0]
            triangle = dataset.createVariable(
                "connectivity", "i4", ("triangle", "vertex3")
            )
            triangle.cf_role = "face_node_connectivity"
            triangle[:] = [[0, 1, 2], [1, 3, 2]]
            codes = dataset.createVariable("lgp2", "i4", ("triangle", "vertex6"))
            codes.long_name = "LGP2 interpolation codes"
            codes[:] = np.arange(12, dtype="int32").reshape(2, 6)
            for index, constituent in enumerate(acquire.EXPECTED_CONSTITUENTS):
                amplitude = dataset.createVariable(
                    f"{constituent}_amp", "f4", ("lgp2_node",)
                )
                phase = dataset.createVariable(
                    f"{constituent}_phase", "f4", ("lgp2_node",)
                )
                amplitude.long_name = f"{constituent} amplitude"
                phase.long_name = f"{constituent} phase"
                amplitude.units = "cm"
                phase.units = "degrees"
                amplitude[:] = np.full(12, index + 1, dtype="float32")
                phase[:] = np.full(12, index, dtype="float32")

    def test_inspector_derives_one_lgp2_file_without_guesses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "native.nc"
            config = root / "fes.yaml"
            self.make_native_fixture(source)
            inspection = acquire.inspect_native_netcdf(source)
            self.assertEqual(inspection["constituentCount"], 34)
            self.assertEqual(inspection["nativeGrid"]["discretization"], "lgp2")
            self.assertEqual(inspection["nativeGrid"]["longitudeVariable"], "mesh_lon")
            self.assertEqual(inspection["nativeGrid"]["latitudeVariable"], "mesh_lat")
            self.assertEqual(inspection["nativeGrid"]["triangleVariable"], "connectivity")
            self.assertEqual(inspection["nativeGrid"]["codesVariable"], "lgp2")
            self.assertEqual(inspection["nativeGrid"]["amplitudePattern"], "{constituent}_amp")
            self.assertEqual(inspection["nativeGrid"]["phasePattern"], "{constituent}_phase")
            acquire.write_native_config(config, inspection)
            text = config.read_text()
            self.assertIn("${FES2022B_NATIVE_FILE}", text)
            self.assertIn("max_distance: 0.0", text)
            self.assertNotIn(str(source), text)

    def test_catalog_parser_binds_exact_dataset_metadata(self) -> None:
        content = b'''<?xml version="1.0"?>
        <catalog xmlns="http://www.unidata.ucar.edu/namespaces/thredds/InvCatalog/v1.0">
          <dataset name="root">
            <dataset name="FES2022b_OceanTide_NSgrid.nc"
              ID="dataset-auxiliary-fes-tide-model/fes2022b/ocean_tide_non_structured/FES2022b_OceanTide_NSgrid.nc"
              urlPath="dataset-auxiliary-fes-tide-model/fes2022b/ocean_tide_non_structured/FES2022b_OceanTide_NSgrid.nc">
              <dataSize units="Gbytes">3.953</dataSize>
              <date type="modified">2026-02-06T10:37:15Z</date>
            </dataset>
          </dataset>
        </catalog>'''
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = content
        response.status = 200
        response.geturl.return_value = acquire.CATALOG_URL
        response.headers = {}
        with mock.patch.object(acquire.urllib.request, "urlopen", return_value=response):
            catalog = acquire.fetch_catalog(5)
        self.assertEqual(catalog["datasetName"], acquire.SOURCE_FILENAME)
        self.assertEqual(catalog["declaredDataSize"]["text"], "3.953")
        self.assertEqual(catalog["declaredDataSize"]["units"], "Gbytes")
        self.assertEqual(catalog["sourceModifiedAtUtc"], "2026-02-06T10:37:15Z")

    def test_catalog_http_error_preserves_status(self) -> None:
        error = acquire.urllib.error.HTTPError(
            acquire.CATALOG_URL, 503, "unavailable", {}, None
        )
        with mock.patch.object(acquire.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(acquire.AcquisitionError) as caught:
                acquire.fetch_catalog(5)
        self.assertEqual(caught.exception.http_status, 503)

    def test_pinned_pyfes_loads_native_fixture_and_round_trips_all_waves(self) -> None:
        import numpy as np
        import pyfes

        self.assertEqual(pyfes.__version__, "2026.5.2")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "native.nc"
            config = root / "fes.yaml"
            self.make_native_fixture(source)
            acquire.write_native_config(config, acquire.inspect_native_netcdf(source))
            with mock.patch.dict(
                os.environ, {"FES2022B_NATIVE_FILE": str(source)}, clear=False
            ):
                configuration = pyfes.config.load(config)
            model = configuration.models["tide"]
            identifiers = list(model.identifiers())
            self.assertEqual(len(identifiers), 34)
            longitudes = np.asarray([0.25], dtype="float64")
            latitudes = np.asarray([0.25], dtype="float64")
            harmonics = build.interpolate_harmonics(
                model, longitudes, latitudes, identifiers, 0.01
            )
            self.assertGreater(int(harmonics["qualityFlags"][0]), 0)
            dates = np.arange(
                np.datetime64("1997-11-26T16:00:00", "s"),
                np.datetime64("1997-11-27T16:00:00", "s"),
                np.timedelta64(1, "h"),
            )
            settings = pyfes.FESSettings().with_compute_long_period_equilibrium(False)
            result = build.round_trip_error(
                pyfes,
                model,
                settings,
                dates,
                [{"longitude": 0.25, "latitude": 0.25}],
                harmonics,
                identifiers,
            )
            self.assertTrue(result["passed"])
            self.assertLessEqual(result["maximumErrorMeters"], 1e-4)
            self.assertLessEqual(result["maximumModelLongPeriodErrorMeters"], 1e-4)
            prediction = build.prediction_for_point(
                pyfes, model, dates, 0.25, 0.25, configuration.settings
            )
            self.assertEqual(prediction["equilibriumLongMeters"].shape, dates.shape)
            self.assertGreater(np.max(np.abs(prediction["modelLongMeters"])), 0.0)
            self.assertTrue(
                np.allclose(
                    prediction["totalMeters"],
                    prediction["shortMeters"] + prediction["modelLongMeters"],
                )
            )

    def test_native_manifest_and_cartesian_config_are_both_supported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "native.nc"
            self.make_native_fixture(source)
            inspection = acquire.inspect_native_netcdf(source)
            config = root / "native.yaml"
            acquire.write_native_config(config, inspection)
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "rawSourceCommitted": False,
                        "sourceBytes": source.stat().st_size,
                        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                        "netcdf": inspection,
                    }
                )
            )
            with mock.patch.dict(os.environ, {"FES2022B_NATIVE_FILE": str(source)}):
                info = build.inspect_config(config)
                verified = build.verify_source_manifest(manifest, info)
            self.assertEqual(info["kind"], "native_non_structured")
            self.assertEqual(verified["sourceBytes"], source.stat().st_size)
            amplitude_unit, meter_factor, amplitude_evidence = build.detect_model_unit(info)
            phase_unit, degree_factor, phase_evidence = build.detect_phase_unit(info)
            self.assertEqual((amplitude_unit, meter_factor), ("centimeter", 0.01))
            self.assertEqual((phase_unit, degree_factor), ("degree", 1.0))
            self.assertEqual(amplitude_evidence["rawUnit"], "cm")
            self.assertEqual(phase_evidence["rawUnit"], "degrees")
            self.assertEqual(
                build.report_source_variant(info, verified, "native"),
                "native_non_structured",
            )
            self.assertEqual(
                build.portable_config_reference(config, info),
                build.CONFIG_REPOSITORY_PATH,
            )

            cartesian = root / "cartesian.yaml"
            cartesian.write_text(
                "tide:\n  cartesian:\n    paths:\n      M2: native.nc\n",
                encoding="utf-8",
            )
            cartesian_info = build.inspect_config(cartesian)
            self.assertEqual(cartesian_info["kind"], "cartesian")
            self.assertEqual(cartesian_info["files"]["M2"], source)
            cartesian_manifest = build.verify_source_manifest(None, cartesian_info)
            self.assertEqual(
                build.report_source_variant(
                    cartesian_info, cartesian_manifest, "cartesian"
                ),
                "cartesian",
            )
            with self.assertRaises(RuntimeError):
                build.report_source_variant(
                    cartesian_info, cartesian_manifest, "extrapolated"
                )

    def test_missing_secrets_fails_without_model_or_success_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "model.nc"
            config = root / "config.yaml"
            manifest = root / "manifest.json"
            failure = root / "failure.json"
            argv = [
                "acquire_fes2022b_native.py",
                "--output",
                str(output),
                "--config-output",
                str(config),
                "--manifest-output",
                str(manifest),
                "--failure-report",
                str(failure),
            ]
            with mock.patch.dict(
                os.environ,
                {"AVISO_FES_USERNAME": "", "AVISO_FES_PASSWORD": ""},
                clear=False,
            ), mock.patch.object(sys, "argv", argv):
                self.assertEqual(acquire.main(), 3)
            report = json.loads(failure.read_text())
            self.assertEqual(
                report["missingSecretNames"],
                ["AVISO_FES_USERNAME", "AVISO_FES_PASSWORD"],
            )
            self.assertIsNone(report["httpStatus"])
            self.assertFalse(output.exists())
            self.assertFalse(config.exists())
            self.assertFalse(manifest.exists())

    def test_raw_source_requires_an_approved_private_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            argv = [
                "acquire_fes2022b_native.py",
                "--output",
                str(root / "model.nc"),
                "--config-output",
                str(root / "config.yaml"),
                "--manifest-output",
                str(root / "manifest.json"),
                "--failure-report",
                str(root / "failure.json"),
            ]
            environment = {
                "AVISO_FES_USERNAME": "configured-user",
                "AVISO_FES_PASSWORD": "configured-password",
            }
            with mock.patch.dict(os.environ, environment, clear=True), mock.patch.object(
                sys, "argv", argv
            ), mock.patch.object(acquire, "fetch_catalog") as fetch:
                self.assertEqual(acquire.main(), 4)
            fetch.assert_not_called()
            report = json.loads((root / "failure.json").read_text())
            self.assertEqual(report["failureKind"], "runtime_path_policy")
            self.assertFalse((root / "model.nc").exists())

    def test_failure_evidence_redacts_credentials_and_basic_token(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            username = "sentinel-user-value"
            password = "sentinel-password-value"
            token = acquire.base64.b64encode(
                f"{username}:{password}".encode("utf-8")
            ).decode("ascii")
            argv = [
                "acquire_fes2022b_native.py",
                "--output",
                str(root / "model.nc"),
                "--config-output",
                str(root / "config.yaml"),
                "--manifest-output",
                str(root / "manifest.json"),
                "--failure-report",
                str(root / "failure.json"),
            ]
            environment = {
                "AVISO_FES_USERNAME": username,
                "AVISO_FES_PASSWORD": password,
                "RUNNER_TEMP": str(root),
            }
            stderr = io.StringIO()
            with mock.patch.dict(os.environ, environment, clear=True), mock.patch.object(
                sys, "argv", argv
            ), mock.patch.object(
                acquire, "fetch_catalog", return_value={"sourceFileListed": True}
            ), mock.patch.object(
                acquire,
                "download_with_resume",
                side_effect=RuntimeError(
                    f"unsafe {username} {password} Basic {token}"
                ),
            ), redirect_stderr(stderr):
                self.assertEqual(acquire.main(), 5)
            evidence = (root / "failure.json").read_text() + stderr.getvalue()
            self.assertNotIn(username, evidence)
            self.assertNotIn(password, evidence)
            self.assertNotIn(token, evidence)
            self.assertIn("[REDACTED]", evidence)

    def test_authenticated_cross_host_redirect_is_rejected(self) -> None:
        request = mock.Mock(full_url="https://tds-odatis.aviso.altimetry.fr/source")
        with self.assertRaises(acquire.AcquisitionError):
            acquire.SameHostRedirectHandler().redirect_request(
                request,
                None,
                302,
                "redirect",
                {},
                "https://example.org/target",
            )

    def test_authenticated_https_downgrade_redirect_is_rejected(self) -> None:
        request = mock.Mock(full_url="https://tds-odatis.aviso.altimetry.fr/source")
        with self.assertRaises(acquire.AcquisitionError):
            acquire.SameHostRedirectHandler().redirect_request(
                request,
                None,
                302,
                "redirect",
                {},
                "http://tds-odatis.aviso.altimetry.fr/target",
            )

    def test_authenticated_port_change_redirect_is_rejected(self) -> None:
        request = mock.Mock(full_url="https://tds-odatis.aviso.altimetry.fr/source")
        with self.assertRaises(acquire.AcquisitionError):
            acquire.SameHostRedirectHandler().redirect_request(
                request,
                None,
                302,
                "redirect",
                {},
                "https://tds-odatis.aviso.altimetry.fr:444/target",
            )

    def test_real_frozen_boundary_has_8118_unique_valid_centers(self) -> None:
        boundary = build.boundary_coordinates()
        self.assertEqual(len(boundary["boundary_index"]), 8118)
        pairs = set(zip(boundary["row"].tolist(), boundary["column"].tolist(), strict=True))
        self.assertEqual(len(pairs), 8118)
        self.assertTrue((boundary["longitude"] >= -180).all())
        self.assertTrue((boundary["longitude"] <= 180).all())
        self.assertTrue((boundary["latitude"] >= -90).all())
        self.assertTrue((boundary["latitude"] <= 90).all())

    def test_daily_ranges_are_35_complete_windows_from_series_start(self) -> None:
        import numpy as np

        dates = np.arange(
            np.datetime64("1997-11-26T16:00:00", "s"),
            np.datetime64("1997-12-31T16:00:00", "s"),
            np.timedelta64(15, "m"),
        )
        values = np.sin(np.arange(dates.size, dtype="float64") / 20.0)
        ranges = build.daily_ranges(dates, values)
        self.assertEqual(len(ranges), 35)
        self.assertTrue(all(item["complete"] for item in ranges))
        self.assertTrue(all(item["sampleCount"] == 96 for item in ranges))
        self.assertEqual(ranges[0]["windowStartUtc"], "1997-11-26T16:00:00Z")
        self.assertEqual(
            ranges[-1]["windowEndExclusiveUtc"], "1997-12-31T16:00:00Z"
        )
        undefined_ranges = build.daily_ranges(
            dates, np.full(dates.shape, np.nan, dtype="float64")
        )
        complete_ranges = [item for item in undefined_ranges if item["complete"]]
        self.assertEqual(len(undefined_ranges), 35)
        self.assertTrue(all(item["rangeMeters"] is None for item in undefined_ranges))
        self.assertIsNone(
            max(
                complete_ranges,
                key=lambda item: item["rangeMeters"],
                default=None,
            )
        )

    def test_workflow_is_dispatch_only_and_never_artifacts_raw_source(self) -> None:
        workflow = (REPO_ROOT / ".github/workflows/wenzhou-fes2022b.yml").read_text()
        self.assertRegex(workflow, r"(?m)^on:\n  workflow_dispatch:\s*$")
        self.assertNotRegex(workflow, r"(?m)^  (push|pull_request):")
        self.assertIn("AVISO_FES_USERNAME: ${{ secrets.AVISO_FES_USERNAME }}", workflow)
        self.assertIn("AVISO_FES_PASSWORD: ${{ secrets.AVISO_FES_PASSWORD }}", workflow)
        artifact_blocks = workflow.split("uses: actions/upload-artifact@v4")[1:]
        self.assertTrue(artifact_blocks)
        for block in artifact_blocks:
            block = block.split("      - name:", 1)[0]
            self.assertNotIn("FES_NATIVE_FILE", block)
            self.assertNotIn("FES2022b_OceanTide_NSgrid.nc", block)
        self.assertNotIn("git push --force", workflow)
        self.assertIn("git merge-base --is-ancestor", workflow)


if __name__ == "__main__":
    unittest.main()
