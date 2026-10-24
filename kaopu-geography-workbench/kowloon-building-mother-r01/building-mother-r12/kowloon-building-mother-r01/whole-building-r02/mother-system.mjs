/**
 * Common controller for the three source-bound DESIGN building systems.
 * This module adapts names, not geometry, source records, model schemas or
 * renderer behavior. It is not a claim that a rendered three-case UI exists.
 *
 * The six source/configuration interfaces live in controller.configuration;
 * model.interfaces remains the native stair/lift geometry contract. Metadata
 * is deliberately kept outside the model, including the frozen KCC model.
 * Native levels already use localY === elevation (source-local metres) and
 * fflM === elevationMpd (Hong Kong Principal Datum metres).
 */
import * as Kcc from '../whole-building-r01/tower.mjs';
import * as Cases from './case-systems.mjs';
import { profileFor } from '../r07/profiles.mjs';
import {
  CASE_SYSTEM_INTERFACES, caseSystemConfig, resolveCaseParameters,
} from './case-config.mjs';

export { CASE_SYSTEM_INTERFACES };

const controllers = new Map();

/**
 * Return the same immutable controller for a supported case ID. Configuration
 * and profile getters return fresh copies; editing them cannot change geometry
 * or another caller's metadata. All model operations reject another case.
 *
 * derive(measured, official, parameters) returns the native model unchanged.
 * KCC deliberately bypasses resolveCaseParameters: the original implementation
 * owns its defaults, validation and legacy alias precedence. resolveParameters
 * is an explicit, stricter configuration utility, not a KCC derive preprocessor.
 *
 * route(model, floorId, options) is personnel/stair or lift circulation;
 * warehouse additionally preserves its native 'freight' mode alias. Its
 * separate loadingRoute(model) retains vehicle/freight role separation.
 * Lowrise createLiftState returns null, visuals/links are empty, and movement
 * or lift routes throw. No lift is inferred or synthesized.
 */
export function controllerFor(caseId) {
  if (controllers.has(caseId)) return controllers.get(caseId);
  const configuration = caseSystemConfig(caseId); // Validate IDs without coercion.
  const isKcc = caseId === 'kcc';
  const modelSchema = isKcc ? Kcc.WHOLE_BUILDING_SCHEMA : Cases.CASE_SYSTEM_SCHEMA;
  const source = isKcc ? Kcc : Cases;
  const operations = {
    route: isKcc ? Kcc.routeWholeBuilding : Cases.routeCaseSystem,
    query: isKcc ? Kcc.queryWholeBuilding : Cases.queryCaseSystem,
    ray: isKcc ? Kcc.intersectWholeBuildingRay : Cases.intersectCaseSystemRay,
    validate: isKcc ? Kcc.validateWholeBuilding : Cases.validateCaseSystem,
    selectedInstances: isKcc ? Kcc.selectedInstances : Cases.selectedCaseInstances,
    packDescriptors: isKcc ? Kcc.packWholeBuildingDescriptors : Cases.packCaseSystemDescriptors,
    createLiftState: source.createLiftState,
    targetLift: source.targetLift,
    advanceLift: source.advanceLift,
    liftVisuals: source.liftVisuals,
    liftDoorLinks: source.liftDoorLinks,
    loadingRoute: isKcc
      ? () => { throw new Error('No loading route for KCC'); }
      : Cases.loadingRouteCaseSystem,
  };
  const guarded = Object.fromEntries(Object.entries(operations).map(([name, operation]) => [
    name,
    (model, ...args) => {
      if (model?.caseId !== caseId || model?.schema !== modelSchema) {
        throw new Error('Matching ' + caseId + ' building-system model required');
      }
      return operation(model, ...args);
    },
  ]));
  const controller = Object.freeze({
    caseId,
    modelSchema,
    interfaceNames: CASE_SYSTEM_INTERFACES,
    get configuration() { return caseSystemConfig(caseId); },
    get profile() { return profileFor(caseId); },
    capabilities: Object.freeze({
      liftInterfaceCount: configuration.coreServiceSets.reduce(
        (count, core) => count + core.lifts.designInterfaceCount, 0,
      ),
      loadingRoute: caseId === 'warehouse',
      routeModes: Object.freeze(caseId === 'warehouse'
        ? ['stairs', 'lift', 'freight'] : [...configuration.circulationPolicy.allowedModes]),
    }),
    resolveParameters: parameters => resolveCaseParameters(caseId, parameters),
    derive: isKcc
      ? (measured, official, parameters) => Kcc.deriveWholeBuilding(measured, official, parameters)
      : (measured, official, parameters) => Cases.deriveCaseSystem(caseId, measured, official, parameters),
    ...guarded,
  });
  controllers.set(caseId, controller);
  return controller;
}
