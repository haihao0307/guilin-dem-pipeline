'use strict';
// Test-driver advice only. It operates the real controls, never edits Session.
// Conservative low-speed approach tolerates software renderer event cadence.
exports.approachAction=(view,target)=>{
 if(view.distance+view.brakingDistance>=target-3.2)return 'brake';
 if(view.velocity>1.2&&view.throttle>0)return 'decelerate';
 if(view.velocity<.6&&view.throttle<1)return 'accelerate';
 return 'wait';
};
