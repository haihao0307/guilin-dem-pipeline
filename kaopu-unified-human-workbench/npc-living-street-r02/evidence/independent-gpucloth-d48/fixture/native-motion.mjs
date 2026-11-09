// Explicit isolated fixture adapter. This is NOT the original animation module.
// The unmodified CoupledCloth constructor returns the exported neutral actor API.
// It creates no body, pose, force, contact proxy, cloth constraint or time step.
export class NativeMotion {
  constructor(packet) {
    if(!packet?.bridge) throw Error('Neutral fixed-D bridge is required.');
    return packet.bridge;
  }
}
