function createWebGL2Context(canvas, qa) {
  const attempts = [];
  let activeAttempt = null;
  const onCreationError = event => {
    if (activeAttempt) activeAttempt.messages.push(event.statusMessage || 'WebGL2 context creation failed without browser details');
  };
  canvas.addEventListener('webglcontextcreationerror', onCreationError);
  try {
    for (const powerPreference of ['high-performance', 'default', 'low-power']) {
      activeAttempt = { powerPreference, success: false, messages: [] };
      attempts.push(activeAttempt);
      let context = null;
      try {
        const attributes = { alpha: false, antialias: false };
        if (powerPreference !== 'default') attributes.powerPreference = powerPreference;
        context = canvas.getContext('webgl2', attributes);
      } catch (error) {
        activeAttempt.messages.push(error && error.message ? error.message : String(error));
      }
      if (context) {
        activeAttempt.success = true;
        qa.contextCreation = { ready: true, selectedPowerPreference: powerPreference, attempts };
        return context;
      }
    }
    qa.contextCreation = { ready: false, selectedPowerPreference: null, attempts };
    return null;
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', onCreationError);
  }
}
