"""Builder rejection tests use temporary inputs; release artifacts stay untouched."""
from pathlib import Path
import hashlib
import importlib.util
import json
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dwelling_template', HERE / 'build_template.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class BuilderGuards(unittest.TestCase):
    def test_duplicate_and_unsafe_keys_are_rejected(self):
        for raw in ['{"x":1,"x":2}', '{"__proto__":{}}', '{"constructor":1}', '{"prototype":1}', '{"x":NaN}']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                builder.read_json(raw)

    def test_profile_and_exact_generator_closure(self):
        self.assertEqual(builder.PROFILE, 'kaopu.dwelling-unit/0.2-experimental')
        self.assertEqual(builder.SCORE_SCHEMA, 'kaopu.dwelling-unit/2')
        self.assertEqual(builder.OPERATOR, 'kaopu.dwelling-unit')
        self.assertEqual(len(builder.REQUIRED_DEPENDENCY_IDS), 8)
        self.assertIn('native__timber__original-core.mjs', builder.REQUIRED_DEPENDENCY_IDS)

    def test_dependencies_require_matching_hash_and_complete_closure(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            data = directory / 'inert.mjs'
            data.write_text('// inert test source\n')
            pin = {'id': 'room-recipe.mjs', 'version': 'walled-city-room-r02',
                   'sha256': hashlib.sha256(data.read_bytes()).hexdigest(), 'localPath': str(data)}
            source = directory / 'input.json'
            source.write_text(json.dumps([pin]))
            with self.assertRaisesRegex(ValueError, 'Complete dwelling'):
                builder.load_dependencies(source)
            pin['sha256'] = '0' * 64
            source.write_text(json.dumps([pin]))
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                builder.load_dependencies(source)
            for bad_path in ['https://invalid.example/file', 'missing-file.mjs']:
                pin['localPath'] = bad_path
                source.write_text(json.dumps([pin]))
                with self.assertRaises(ValueError):
                    builder.load_dependencies(source)

    def test_input_shape_duplicate_id_and_invalid_id_rejected(self):
        for value in [{}, [], [{'id': '../room-recipe.mjs'}], [None]]:
            with tempfile.TemporaryDirectory() as tmp:
                source = Path(tmp) / 'input.json'
                source.write_text(json.dumps(value))
                with self.subTest(value=value), self.assertRaises(ValueError):
                    builder.load_dependencies(source)

if __name__ == '__main__':
    unittest.main(verbosity=2)
