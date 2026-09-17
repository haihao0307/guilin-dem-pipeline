#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Cell {
  double water_m3 = 0.0;
  double suspended_kg = 0.0;
  double bed_kg = 1000.0;
};

struct Ledger {
  double rain_m3 = 0.0;
  double internal_water_m3 = 0.0;
  double internal_sediment_kg = 0.0;
  double boundary_water_m3 = 0.0;
  double boundary_sediment_kg = 0.0;
  double detached_kg = 0.0;
  double deposited_kg = 0.0;
};

struct Run {
  std::string name;
  Cell upstream;
  Cell downstream;
  Ledger ledger;
  double water_residual_m3 = 0.0;
  double sediment_residual_kg = 0.0;
  double bed_identity_residual_kg = 0.0;
  double suspended_identity_residual_kg = 0.0;
};

static constexpr double kInitialWaterM3 = 0.0;
static constexpr double kInitialSedimentKg = 2000.0;
static constexpr double kErosionCapacityKgPerM3 = 4.0;
static constexpr double kDownstreamCapacityKgPerM3 = 1.0;
static constexpr double kMaxDetachmentKgPerStep = 3.0;
static constexpr double kInternalTransferFraction = 0.5;
static constexpr double kDepositionFraction = 0.6;
static constexpr double kBoundaryOutflowFraction = 0.4;

static void step(Run& run, double rain_m3) {
  Cell& u = run.upstream;
  Cell& d = run.downstream;
  Ledger& l = run.ledger;

  u.water_m3 += rain_m3;
  l.rain_m3 += rain_m3;

  const double capacity = kErosionCapacityKgPerM3 * u.water_m3;
  const double detach = std::min({u.bed_kg,
                                  kMaxDetachmentKgPerStep,
                                  std::max(0.0, capacity - u.suspended_kg)});
  u.bed_kg -= detach;
  u.suspended_kg += detach;
  l.detached_kg += detach;

  const double transfer_water = u.water_m3 * kInternalTransferFraction;
  const double transfer_sediment = u.suspended_kg * kInternalTransferFraction;
  u.water_m3 -= transfer_water;
  u.suspended_kg -= transfer_sediment;
  d.water_m3 += transfer_water;
  d.suspended_kg += transfer_sediment;
  l.internal_water_m3 += transfer_water;
  l.internal_sediment_kg += transfer_sediment;

  const double downstream_capacity = kDownstreamCapacityKgPerM3 * d.water_m3;
  const double deposit = kDepositionFraction *
      std::max(0.0, d.suspended_kg - downstream_capacity);
  d.suspended_kg -= deposit;
  d.bed_kg += deposit;
  l.deposited_kg += deposit;

  const double boundary_water = d.water_m3 * kBoundaryOutflowFraction;
  const double boundary_sediment = d.suspended_kg * kBoundaryOutflowFraction;
  d.water_m3 -= boundary_water;
  d.suspended_kg -= boundary_sediment;
  l.boundary_water_m3 += boundary_water;
  l.boundary_sediment_kg += boundary_sediment;
}

static Run simulate(const std::string& name, const std::vector<double>& rain) {
  Run run;
  run.name = name;
  for (double amount : rain) step(run, amount);

  const double final_water = run.upstream.water_m3 + run.downstream.water_m3;
  const double final_sediment = run.upstream.bed_kg + run.upstream.suspended_kg +
                                run.downstream.bed_kg + run.downstream.suspended_kg;
  run.water_residual_m3 = kInitialWaterM3 + run.ledger.rain_m3 -
                          run.ledger.boundary_water_m3 - final_water;
  run.sediment_residual_kg = kInitialSedimentKg -
                             run.ledger.boundary_sediment_kg - final_sediment;
  const double final_bed = run.upstream.bed_kg + run.downstream.bed_kg;
  const double final_suspended = run.upstream.suspended_kg + run.downstream.suspended_kg;
  run.bed_identity_residual_kg = kInitialSedimentKg - run.ledger.detached_kg +
                                 run.ledger.deposited_kg - final_bed;
  run.suspended_identity_residual_kg = run.ledger.detached_kg -
      run.ledger.deposited_kg - run.ledger.boundary_sediment_kg - final_suspended;
  return run;
}

static bool near_zero(double value) { return std::abs(value) < 1e-10; }

static std::string number(double value) {
  if (std::abs(value) < 5e-13) value = 0.0;
  std::ostringstream out;
  out << std::fixed << std::setprecision(12) << value;
  return out.str();
}

static void emit_cell(std::ostream& out, const Cell& c) {
  out << "{\"water_m3\":" << number(c.water_m3)
      << ",\"suspended_kg\":" << number(c.suspended_kg)
      << ",\"bed_kg\":" << number(c.bed_kg) << "}";
}

static void emit_run(std::ostream& out, const Run& run) {
  out << "{\"name\":\"" << run.name << "\",\"final\":{\"upstream\":";
  emit_cell(out, run.upstream);
  out << ",\"downstream\":";
  emit_cell(out, run.downstream);
  out << "},\"ledger\":{"
      << "\"rain_m3\":" << number(run.ledger.rain_m3)
      << ",\"internal_water_m3\":" << number(run.ledger.internal_water_m3)
      << ",\"internal_sediment_kg\":" << number(run.ledger.internal_sediment_kg)
      << ",\"boundary_water_m3\":" << number(run.ledger.boundary_water_m3)
      << ",\"boundary_sediment_kg\":" << number(run.ledger.boundary_sediment_kg)
      << ",\"detached_kg\":" << number(run.ledger.detached_kg)
      << ",\"deposited_kg\":" << number(run.ledger.deposited_kg)
      << "},\"residuals\":{"
      << "\"water_m3\":" << number(run.water_residual_m3)
      << ",\"sediment_kg\":" << number(run.sediment_residual_kg)
      << ",\"bed_identity_kg\":" << number(run.bed_identity_residual_kg)
      << ",\"suspended_identity_kg\":" << number(run.suspended_identity_residual_kg)
      << "}}";
}

int main(int argc, char** argv) {
  if (argc != 2) {
    std::cerr << "usage: erosion_state_contract_probe_n08 OUTPUT.json\n";
    return 2;
  }

  const Run early = simulate("early_pulse", {2.0, 0.0, 0.0});
  const Run late = simulate("late_pulse", {0.0, 0.0, 2.0});
  const Run replay = simulate("early_pulse", {2.0, 0.0, 0.0});

  const double area_m2 = 20.0;
  const double bulk_density_kg_m3 = 1600.0;
  const double positive_offset_m = 0.01;
  const double unbooked_positive_mass_kg = area_m2 * positive_offset_m * bulk_density_kg_m3;
  const double zero_mean_global_mass_kg = 10.0 * positive_offset_m * bulk_density_kg_m3 +
                                          10.0 * -positive_offset_m * bulk_density_kg_m3;
  const double history_distribution_l1_kg =
      std::abs(early.upstream.bed_kg - late.upstream.bed_kg) +
      std::abs(early.upstream.suspended_kg - late.upstream.suspended_kg) +
      std::abs(early.downstream.bed_kg - late.downstream.bed_kg) +
      std::abs(early.downstream.suspended_kg - late.downstream.suspended_kg);

  struct Check { std::string id; bool pass; };
  const std::vector<Check> checks = {
      {"early-water-conservation", near_zero(early.water_residual_m3)},
      {"early-sediment-conservation", near_zero(early.sediment_residual_kg)},
      {"late-water-conservation", near_zero(late.water_residual_m3)},
      {"late-sediment-conservation", near_zero(late.sediment_residual_kg)},
      {"same-rainfall-total", std::abs(early.ledger.rain_m3 - late.ledger.rain_m3) < 1e-12},
      {"history-changes-final-distribution", history_distribution_l1_kg > 1.0},
      {"history-changes-boundary-export", std::abs(early.ledger.boundary_sediment_kg - late.ledger.boundary_sediment_kg) > 0.1},
      {"nonnegative-state", early.upstream.water_m3 >= 0 && early.downstream.water_m3 >= 0 && early.upstream.suspended_kg >= 0 && early.downstream.suspended_kg >= 0 && early.upstream.bed_kg >= 0 && early.downstream.bed_kg >= 0 && late.upstream.water_m3 >= 0 && late.downstream.water_m3 >= 0 && late.upstream.suspended_kg >= 0 && late.downstream.suspended_kg >= 0 && late.upstream.bed_kg >= 0 && late.downstream.bed_kg >= 0},
      {"internal-water-flux-not-global-source", early.ledger.internal_water_m3 > early.ledger.boundary_water_m3 && near_zero(early.water_residual_m3)},
      {"detachment-bed-identity", near_zero(early.bed_identity_residual_kg) && near_zero(late.bed_identity_residual_kg)},
      {"deposition-suspension-identity", near_zero(early.suspended_identity_residual_kg) && near_zero(late.suspended_identity_residual_kg)},
      {"omitted-boundary-water-fails", early.ledger.boundary_water_m3 > 0.1},
      {"positive-noise-offset-creates-unbooked-mass", std::abs(unbooked_positive_mass_kg - 320.0) < 1e-12},
      {"zero-mean-noise-is-not-process-proof", near_zero(zero_mean_global_mass_kg)},
      {"deterministic-replay", near_zero(early.upstream.water_m3 - replay.upstream.water_m3) && near_zero(early.downstream.water_m3 - replay.downstream.water_m3) && near_zero(early.ledger.boundary_sediment_kg - replay.ledger.boundary_sediment_kg)}
  };
  int passed = 0;
  for (const auto& check : checks) if (check.pass) ++passed;

  std::ofstream out(argv[1]);
  out << "{\n"
      << "  \"id\": \"KAOPU-EROSION-N08-STATE-CONTRACT-A\",\n"
      << "  \"status\": \"" << (passed == static_cast<int>(checks.size()) ? "pass" : "fail") << "\",\n"
      << "  \"scope\": \"two-cell deterministic bookkeeping counterexample; not a calibrated erosion solver\",\n"
      << "  \"units\": {\"water\":\"m3\",\"sediment\":\"kg\",\"bed\":\"kg\",\"height\":\"m\"},\n"
      << "  \"fixed_parameters\": {\"erosion_capacity_kg_per_m3\":" << number(kErosionCapacityKgPerM3)
      << ",\"downstream_capacity_kg_per_m3\":" << number(kDownstreamCapacityKgPerM3)
      << ",\"max_detachment_kg_per_step\":" << number(kMaxDetachmentKgPerStep)
      << ",\"internal_transfer_fraction\":" << number(kInternalTransferFraction)
      << ",\"deposition_fraction\":" << number(kDepositionFraction)
      << ",\"boundary_outflow_fraction\":" << number(kBoundaryOutflowFraction) << "},\n"
      << "  \"histories\": [";
  emit_run(out, early);
  out << ",";
  emit_run(out, late);
  out << "],\n"
      << "  \"counterexamples\": {\n"
      << "    \"same_total_rain_different_history\": {\"rain_m3\":" << number(early.ledger.rain_m3)
      << ",\"final_distribution_l1_kg\":" << number(history_distribution_l1_kg)
      << ",\"early_boundary_sediment_kg\":" << number(early.ledger.boundary_sediment_kg)
      << ",\"late_boundary_sediment_kg\":" << number(late.ledger.boundary_sediment_kg) << "},\n"
      << "    \"omitted_open_boundary\": {\"apparent_water_residual_m3\":" << number(early.ledger.boundary_water_m3)
      << ",\"apparent_sediment_residual_kg\":" << number(early.ledger.boundary_sediment_kg) << "},\n"
      << "    \"positive_height_noise\": {\"area_m2\":" << number(area_m2)
      << ",\"offset_m\":" << number(positive_offset_m)
      << ",\"bulk_density_kg_m3\":" << number(bulk_density_kg_m3)
      << ",\"unbooked_mass_kg\":" << number(unbooked_positive_mass_kg)
      << ",\"semantic_gate\":\"reject-unbooked-solid-source\"},\n"
      << "    \"zero_mean_height_noise\": {\"global_mass_change_kg\":" << number(zero_mean_global_mass_kg)
      << ",\"semantic_gate\":\"reject-missing-water-sediment-flux-history-even-when-global-mass-is-zero\"}\n"
      << "  },\n"
      << "  \"minimum_receipt\": [\"cell_or_support_id\",\"half_open_time_interval\",\"water_storage_m3\",\"suspended_sediment_kg\",\"bed_or_mobile_solid_kg\",\"directed_internal_fluxes\",\"external_sources_and_sinks\",\"boundary_exports\",\"detachment_and_deposition_transfers\",\"event_identity_and_revision_chain\",\"parameter_and_solver_revision\"],\n"
      << "  \"checks\": [\n";
  for (size_t i = 0; i < checks.size(); ++i) {
    out << "    {\"id\":\"" << checks[i].id << "\",\"pass\":" << (checks[i].pass ? "true" : "false") << "}";
    out << (i + 1 == checks.size() ? "\n" : ",\n");
  }
  out << "  ],\n"
      << "  \"summary\": {\"checks\":" << checks.size() << ",\"passed\":" << passed
      << ",\"failed\":" << (checks.size() - passed) << "}\n"
      << "}\n";
  out.close();

  std::cout << passed << "/" << checks.size() << " checks passed\n";
  return passed == static_cast<int>(checks.size()) ? 0 : 1;
}
