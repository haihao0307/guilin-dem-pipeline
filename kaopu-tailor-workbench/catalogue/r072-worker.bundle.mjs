import {preflightSizing} from '../r07/stability/fit-preflight.mjs';
import {requiresGatheredStitchSites} from '../r07/stability/gathering.mjs';
import {beginJointRefinement,finalizeCloseSeams,jointReport} from '../r07/stability/refinement.mjs';
import {coplanarPositiveOverlap,staticGate} from '../r07/stability/audit.mjs';
import {prepareAssembly,createSeamLayerGuide} from '../r07/assembly.mjs';
// R06.2 additive worker. Original catalogue/workbench-worker.bundle.mjs remains intact.
// Temporary assembly fixtures derived from the original shoulder seams and exact-body SDF.
// Never modifies UVs, triangles, analytic curves, body geometry, or permanent constraints.
function prepareShoulderFixtures(spec,sdf){
 const panels=new Map(spec.panels.map(p=>[p.id,p]));const q=new Float64Array(5);let count=0;
 const world=(p,id)=>{const [u,v]=p.uvMm[id],b=p.placement.rigidBasis,t=p.placement.translationMm;return[(b[0]*u+b[1]*v+t[0])/1000,(b[3]*u+b[4]*v+t[1])/1000,(b[6]*u+b[7]*v+t[2])/1000];};
 for(const seam of spec.seams.filter(s=>s.stageId==='shoulders')){
  const a=panels.get(seam.a.panelId),b=panels.get(seam.b.panelId),pairs=seam.stitchVertexPairs;
  if(!a||!b||!pairs?.length)continue;
  const endpoints=[pairs[0],pairs.at(-1)];
  const pair=endpoints.sort((p1,p2)=>Math.abs(world(a,p2[0])[0])-Math.abs(world(a,p1[0])[0]))[0];
  const pa=world(a,pair[0]),pb=world(b,pair[1]);const x=(pa[0]+pb[0])/2,z=.008860204985917;
  // This Z slice is the existing Anny acromion surface landmark plane, not a replacement body.
  let previous=sdf.sample(x,1.68,z,q)[0],hit=null;
  for(let y=1.678;y>1.36;y-=.002){const d=sdf.sample(x,y,z,q)[0];if(previous>=.004&&d<.004){let lo=y,upper=y+.002;for(let j=0;j<18;j++){const mid=(lo+upper)/2;if(sdf.sample(x,mid,z,q)[0]<.004)lo=mid;else upper=mid;}hit=[x,(lo+upper)/2,z];break;}previous=d;}
  if(!hit)continue;
  for(const [p,id,side]of[[a,pair[0],1],[b,pair[1],-1]]){
   if(!p.temporaryPins.includes(id))p.temporaryPins.push(id);
   p.temporaryPinTargetsMm[id]=hit.map((v,k)=>v*1000+(k===2?side*.4:0));count++;
  }
 }
 spec.source.temporaryFixturePlan={count,method:'outer endpoints of original shoulder seams; upward full-body-SDF contact in recorded Anny acromion Z plane',releasedBeforeGravity:true,doesNotAlterRestMaterial:true};
 return count;
}

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tailor-unify-20261007/toolchain/node_modules/binary-search-bounds/search-bounds.js
var require_search_bounds = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/binary-search-bounds/search-bounds.js"(exports, module2) {
    "use strict";
    function ge(a, y, c, l, h) {
      var i = h + 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p >= 0) {
          i = m;
          h = m - 1;
        } else {
          l = m + 1;
        }
      }
      return i;
    }
    function gt(a, y, c, l, h) {
      var i = h + 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p > 0) {
          i = m;
          h = m - 1;
        } else {
          l = m + 1;
        }
      }
      return i;
    }
    function lt(a, y, c, l, h) {
      var i = l - 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p < 0) {
          i = m;
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return i;
    }
    function le(a, y, c, l, h) {
      var i = l - 1;
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p <= 0) {
          i = m;
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return i;
    }
    function eq(a, y, c, l, h) {
      while (l <= h) {
        var m = l + h >>> 1, x = a[m];
        var p = c !== void 0 ? c(x, y) : x - y;
        if (p === 0) {
          return m;
        }
        if (p <= 0) {
          l = m + 1;
        } else {
          h = m - 1;
        }
      }
      return -1;
    }
    function norm(a, y, c, l, h, f) {
      if (typeof c === "function") {
        return f(a, y, c, l === void 0 ? 0 : l | 0, h === void 0 ? a.length - 1 : h | 0);
      }
      return f(a, y, void 0, c === void 0 ? 0 : c | 0, l === void 0 ? a.length - 1 : l | 0);
    }
    module2.exports = {
      ge: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, ge);
      },
      gt: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, gt);
      },
      lt: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, lt);
      },
      le: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, le);
      },
      eq: function(a, y, c, l, h) {
        return norm(a, y, c, l, h, eq);
      }
    };
  }
});

// tailor-unify-20261007/toolchain/node_modules/two-product/two-product.js
var require_two_product = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/two-product/two-product.js"(exports, module2) {
    "use strict";
    module2.exports = twoProduct;
    var SPLITTER = +(Math.pow(2, 27) + 1);
    function twoProduct(a, b, result) {
      var x = a * b;
      var c = SPLITTER * a;
      var abig = c - a;
      var ahi = c - abig;
      var alo = a - ahi;
      var d = SPLITTER * b;
      var bbig = d - b;
      var bhi = d - bbig;
      var blo = b - bhi;
      var err1 = x - ahi * bhi;
      var err2 = err1 - alo * bhi;
      var err3 = err2 - ahi * blo;
      var y = alo * blo - err3;
      if (result) {
        result[0] = y;
        result[1] = x;
        return result;
      }
      return [y, x];
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-sum/robust-sum.js
var require_robust_sum = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-sum/robust-sum.js"(exports, module2) {
    "use strict";
    module2.exports = linearExpansionSum;
    function scalarScalar(a, b) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      var y = ar + br;
      if (y) {
        return [y, x];
      }
      return [x];
    }
    function linearExpansionSum(e, f) {
      var ne = e.length | 0;
      var nf = f.length | 0;
      if (ne === 1 && nf === 1) {
        return scalarScalar(e[0], f[0]);
      }
      var n = ne + nf;
      var g = new Array(n);
      var count = 0;
      var eptr = 0;
      var fptr = 0;
      var abs = Math.abs;
      var ei = e[eptr];
      var ea = abs(ei);
      var fi = f[fptr];
      var fa = abs(fi);
      var a, b;
      if (ea < fa) {
        b = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        b = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
          fa = abs(fi);
        }
      }
      if (eptr < ne && ea < fa || fptr >= nf) {
        a = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
          fa = abs(fi);
        }
      }
      var x = a + b;
      var bv = x - a;
      var y = b - bv;
      var q0 = y;
      var q1 = x;
      var _x, _bv, _av, _br, _ar;
      while (eptr < ne && fptr < nf) {
        if (ea < fa) {
          a = ei;
          eptr += 1;
          if (eptr < ne) {
            ei = e[eptr];
            ea = abs(ei);
          }
        } else {
          a = fi;
          fptr += 1;
          if (fptr < nf) {
            fi = f[fptr];
            fa = abs(fi);
          }
        }
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
      }
      while (eptr < ne) {
        a = ei;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
        }
      }
      while (fptr < nf) {
        a = fi;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        fptr += 1;
        if (fptr < nf) {
          fi = f[fptr];
        }
      }
      if (q0) {
        g[count++] = q0;
      }
      if (q1) {
        g[count++] = q1;
      }
      if (!count) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/two-sum/two-sum.js
var require_two_sum = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/two-sum/two-sum.js"(exports, module2) {
    "use strict";
    module2.exports = fastTwoSum;
    function fastTwoSum(a, b, result) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      if (result) {
        result[0] = ar + br;
        result[1] = x;
        return result;
      }
      return [ar + br, x];
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-scale/robust-scale.js
var require_robust_scale = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-scale/robust-scale.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var twoSum = require_two_sum();
    module2.exports = scaleLinearExpansion;
    function scaleLinearExpansion(e, scale) {
      var n = e.length;
      if (n === 1) {
        var ts = twoProduct(e[0], scale);
        if (ts[0]) {
          return ts;
        }
        return [ts[1]];
      }
      var g = new Array(2 * n);
      var q = [0.1, 0.1];
      var t = [0.1, 0.1];
      var count = 0;
      twoProduct(e[0], scale, q);
      if (q[0]) {
        g[count++] = q[0];
      }
      for (var i = 1; i < n; ++i) {
        twoProduct(e[i], scale, t);
        var pq = q[1];
        twoSum(pq, t[0], q);
        if (q[0]) {
          g[count++] = q[0];
        }
        var a = t[1];
        var b = q[1];
        var x = a + b;
        var bv = x - a;
        var y = b - bv;
        q[1] = x;
        if (y) {
          g[count++] = y;
        }
      }
      if (q[1]) {
        g[count++] = q[1];
      }
      if (count === 0) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-subtract/robust-diff.js
var require_robust_diff = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-subtract/robust-diff.js"(exports, module2) {
    "use strict";
    module2.exports = robustSubtract;
    function scalarScalar(a, b) {
      var x = a + b;
      var bv = x - a;
      var av = x - bv;
      var br = b - bv;
      var ar = a - av;
      var y = ar + br;
      if (y) {
        return [y, x];
      }
      return [x];
    }
    function robustSubtract(e, f) {
      var ne = e.length | 0;
      var nf = f.length | 0;
      if (ne === 1 && nf === 1) {
        return scalarScalar(e[0], -f[0]);
      }
      var n = ne + nf;
      var g = new Array(n);
      var count = 0;
      var eptr = 0;
      var fptr = 0;
      var abs = Math.abs;
      var ei = e[eptr];
      var ea = abs(ei);
      var fi = -f[fptr];
      var fa = abs(fi);
      var a, b;
      if (ea < fa) {
        b = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        b = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
          fa = abs(fi);
        }
      }
      if (eptr < ne && ea < fa || fptr >= nf) {
        a = ei;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
          fa = abs(fi);
        }
      }
      var x = a + b;
      var bv = x - a;
      var y = b - bv;
      var q0 = y;
      var q1 = x;
      var _x, _bv, _av, _br, _ar;
      while (eptr < ne && fptr < nf) {
        if (ea < fa) {
          a = ei;
          eptr += 1;
          if (eptr < ne) {
            ei = e[eptr];
            ea = abs(ei);
          }
        } else {
          a = fi;
          fptr += 1;
          if (fptr < nf) {
            fi = -f[fptr];
            fa = abs(fi);
          }
        }
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
      }
      while (eptr < ne) {
        a = ei;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        eptr += 1;
        if (eptr < ne) {
          ei = e[eptr];
        }
      }
      while (fptr < nf) {
        a = fi;
        b = q0;
        x = a + b;
        bv = x - a;
        y = b - bv;
        if (y) {
          g[count++] = y;
        }
        _x = q1 + x;
        _bv = _x - q1;
        _av = _x - _bv;
        _br = x - _bv;
        _ar = q1 - _av;
        q0 = _ar + _br;
        q1 = _x;
        fptr += 1;
        if (fptr < nf) {
          fi = -f[fptr];
        }
      }
      if (q0) {
        g[count++] = q0;
      }
      if (q1) {
        g[count++] = q1;
      }
      if (!count) {
        g[count++] = 0;
      }
      g.length = count;
      return g;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-orientation/orientation.js
var require_orientation = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-orientation/orientation.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var robustSum = require_robust_sum();
    var robustScale = require_robust_scale();
    var robustSubtract = require_robust_diff();
    var NUM_EXPAND = 5;
    var EPSILON = 11102230246251565e-32;
    var ERRBOUND3 = (3 + 16 * EPSILON) * EPSILON;
    var ERRBOUND4 = (7 + 56 * EPSILON) * EPSILON;
    function orientation_3(sum, prod, scale, sub3) {
      return function orientation3Exact2(m0, m1, m2) {
        var p = sum(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])));
        var n = sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0]));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation_4(sum, prod, scale, sub3) {
      return function orientation4Exact2(m0, m1, m2, m3) {
        var p = sum(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))));
        var n = sum(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation_5(sum, prod, scale, sub3) {
      return function orientation5Exact(m0, m1, m2, m3, m4) {
        var p = sum(sum(sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m2[2]), sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), -m3[2]), scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m4[2]))), m1[3]), sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m3[2]), scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m4[2]))), -m2[3]), scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m4[2]))), m3[3]))), sum(scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), -m4[3]), sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m3[2]), scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m3[2]), scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), m4[2]))), -m1[3])))), sum(sum(scale(sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m4[2]))), m3[3]), sum(scale(sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))), -m4[3]), scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m3[2]))), m0[3]))), sum(scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), -m1[3]), sum(scale(sum(scale(sum(prod(m1[1], m3[0]), prod(-m3[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m3[2]))), m2[3]), scale(sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))), -m3[3])))));
        var n = sum(sum(sum(scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m2[2]), sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), -m3[2]), scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m3[1], m4[0]), prod(-m4[1], m3[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m3[2]), scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), m4[2]))), -m2[3])), sum(scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m4[2]))), m3[3]), scale(sum(scale(sum(prod(m2[1], m3[0]), prod(-m3[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m3[0]), prod(-m3[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m3[2]))), -m4[3]))), sum(sum(scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m1[2]), sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), -m2[2]), scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m4[2]))), m0[3]), scale(sum(scale(sum(prod(m2[1], m4[0]), prod(-m4[1], m2[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m2[2]), scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), m4[2]))), -m1[3])), sum(scale(sum(scale(sum(prod(m1[1], m4[0]), prod(-m4[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m4[0]), prod(-m4[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m4[2]))), m2[3]), scale(sum(scale(sum(prod(m1[1], m2[0]), prod(-m2[1], m1[0])), m0[2]), sum(scale(sum(prod(m0[1], m2[0]), prod(-m2[1], m0[0])), -m1[2]), scale(sum(prod(m0[1], m1[0]), prod(-m1[1], m0[0])), m2[2]))), -m4[3]))));
        var d = sub3(p, n);
        return d[d.length - 1];
      };
    }
    function orientation(n) {
      var fn = n === 3 ? orientation_3 : n === 4 ? orientation_4 : orientation_5;
      return fn(robustSum, twoProduct, robustScale, robustSubtract);
    }
    var orientation3Exact = orientation(3);
    var orientation4Exact = orientation(4);
    var CACHED = [
      function orientation0() {
        return 0;
      },
      function orientation1() {
        return 0;
      },
      function orientation2(a, b) {
        return b[0] - a[0];
      },
      function orientation3(a, b, c) {
        var l = (a[1] - c[1]) * (b[0] - c[0]);
        var r = (a[0] - c[0]) * (b[1] - c[1]);
        var det = l - r;
        var s;
        if (l > 0) {
          if (r <= 0) {
            return det;
          } else {
            s = l + r;
          }
        } else if (l < 0) {
          if (r >= 0) {
            return det;
          } else {
            s = -(l + r);
          }
        } else {
          return det;
        }
        var tol = ERRBOUND3 * s;
        if (det >= tol || det <= -tol) {
          return det;
        }
        return orientation3Exact(a, b, c);
      },
      function orientation4(a, b, c, d) {
        var adx = a[0] - d[0];
        var bdx = b[0] - d[0];
        var cdx = c[0] - d[0];
        var ady = a[1] - d[1];
        var bdy = b[1] - d[1];
        var cdy = c[1] - d[1];
        var adz = a[2] - d[2];
        var bdz = b[2] - d[2];
        var cdz = c[2] - d[2];
        var bdxcdy = bdx * cdy;
        var cdxbdy = cdx * bdy;
        var cdxady = cdx * ady;
        var adxcdy = adx * cdy;
        var adxbdy = adx * bdy;
        var bdxady = bdx * ady;
        var det = adz * (bdxcdy - cdxbdy) + bdz * (cdxady - adxcdy) + cdz * (adxbdy - bdxady);
        var permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz) + (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz) + (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz);
        var tol = ERRBOUND4 * permanent;
        if (det > tol || -det > tol) {
          return det;
        }
        return orientation4Exact(a, b, c, d);
      }
    ];
    function slowOrient(args) {
      var proc2 = CACHED[args.length];
      if (!proc2) {
        proc2 = CACHED[args.length] = orientation(args.length);
      }
      return proc2.apply(void 0, args);
    }
    function proc(slow, o0, o1, o2, o3, o4, o5) {
      return function getOrientation(a0, a1, a2, a3, a4) {
        switch (arguments.length) {
          case 0:
          case 1:
            return 0;
          case 2:
            return o2(a0, a1);
          case 3:
            return o3(a0, a1, a2);
          case 4:
            return o4(a0, a1, a2, a3);
          case 5:
            return o5(a0, a1, a2, a3, a4);
        }
        var s = new Array(arguments.length);
        for (var i = 0; i < arguments.length; ++i) {
          s[i] = arguments[i];
        }
        return slow(s);
      };
    }
    function generateOrientationProc() {
      while (CACHED.length <= NUM_EXPAND) {
        CACHED.push(orientation(CACHED.length));
      }
      module2.exports = proc.apply(void 0, [slowOrient].concat(CACHED));
      for (var i = 0; i <= NUM_EXPAND; ++i) {
        module2.exports[i] = CACHED[i];
      }
    }
    generateOrientationProc();
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/monotone.js
var require_monotone = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/monotone.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    var orient = require_orientation()[3];
    var EVENT_POINT = 0;
    var EVENT_END = 1;
    var EVENT_START = 2;
    module2.exports = monotoneTriangulate;
    function PartialHull(a, b, idx, lowerIds, upperIds) {
      this.a = a;
      this.b = b;
      this.idx = idx;
      this.lowerIds = lowerIds;
      this.upperIds = upperIds;
    }
    function Event(a, b, type, idx) {
      this.a = a;
      this.b = b;
      this.type = type;
      this.idx = idx;
    }
    function compareEvent(a, b) {
      var d = a.a[0] - b.a[0] || a.a[1] - b.a[1] || a.type - b.type;
      if (d) {
        return d;
      }
      if (a.type !== EVENT_POINT) {
        d = orient(a.a, a.b, b.b);
        if (d) {
          return d;
        }
      }
      return a.idx - b.idx;
    }
    function testPoint(hull, p) {
      return orient(hull.a, hull.b, p);
    }
    function addPoint(cells, hulls, points, p, idx) {
      var lo = bsearch.lt(hulls, p, testPoint);
      var hi = bsearch.gt(hulls, p, testPoint);
      for (var i = lo; i < hi; ++i) {
        var hull = hulls[i];
        var lowerIds = hull.lowerIds;
        var m = lowerIds.length;
        while (m > 1 && orient(
          points[lowerIds[m - 2]],
          points[lowerIds[m - 1]],
          p
        ) > 0) {
          cells.push(
            [
              lowerIds[m - 1],
              lowerIds[m - 2],
              idx
            ]
          );
          m -= 1;
        }
        lowerIds.length = m;
        lowerIds.push(idx);
        var upperIds = hull.upperIds;
        var m = upperIds.length;
        while (m > 1 && orient(
          points[upperIds[m - 2]],
          points[upperIds[m - 1]],
          p
        ) < 0) {
          cells.push(
            [
              upperIds[m - 2],
              upperIds[m - 1],
              idx
            ]
          );
          m -= 1;
        }
        upperIds.length = m;
        upperIds.push(idx);
      }
    }
    function findSplit(hull, edge) {
      var d;
      if (hull.a[0] < edge.a[0]) {
        d = orient(hull.a, hull.b, edge.a);
      } else {
        d = orient(edge.b, edge.a, hull.a);
      }
      if (d) {
        return d;
      }
      if (edge.b[0] < hull.b[0]) {
        d = orient(hull.a, hull.b, edge.b);
      } else {
        d = orient(edge.b, edge.a, hull.b);
      }
      return d || hull.idx - edge.idx;
    }
    function splitHulls(hulls, points, event) {
      var splitIdx = bsearch.le(hulls, event, findSplit);
      var hull = hulls[splitIdx];
      var upperIds = hull.upperIds;
      var x = upperIds[upperIds.length - 1];
      hull.upperIds = [x];
      hulls.splice(
        splitIdx + 1,
        0,
        new PartialHull(event.a, event.b, event.idx, [x], upperIds)
      );
    }
    function mergeHulls(hulls, points, event) {
      var tmp = event.a;
      event.a = event.b;
      event.b = tmp;
      var mergeIdx = bsearch.eq(hulls, event, findSplit);
      var upper = hulls[mergeIdx];
      var lower = hulls[mergeIdx - 1];
      lower.upperIds = upper.upperIds;
      hulls.splice(mergeIdx, 1);
    }
    function monotoneTriangulate(points, edges) {
      var numPoints = points.length;
      var numEdges = edges.length;
      var events = [];
      for (var i = 0; i < numPoints; ++i) {
        events.push(new Event(
          points[i],
          null,
          EVENT_POINT,
          i
        ));
      }
      for (var i = 0; i < numEdges; ++i) {
        var e = edges[i];
        var a = points[e[0]];
        var b = points[e[1]];
        if (a[0] < b[0]) {
          events.push(
            new Event(a, b, EVENT_START, i),
            new Event(b, a, EVENT_END, i)
          );
        } else if (a[0] > b[0]) {
          events.push(
            new Event(b, a, EVENT_START, i),
            new Event(a, b, EVENT_END, i)
          );
        }
      }
      events.sort(compareEvent);
      var minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52);
      var hull = [new PartialHull([minX, 1], [minX, 0], -1, [], [], [], [])];
      var cells = [];
      for (var i = 0, numEvents = events.length; i < numEvents; ++i) {
        var event = events[i];
        var type = event.type;
        if (type === EVENT_POINT) {
          addPoint(cells, hull, points, event.a, event.idx);
        } else if (type === EVENT_START) {
          splitHulls(hull, points, event);
        } else {
          mergeHulls(hull, points, event);
        }
      }
      return cells;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/triangulation.js
var require_triangulation = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/triangulation.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    module2.exports = createTriangulation;
    function Triangulation(stars, edges) {
      this.stars = stars;
      this.edges = edges;
    }
    var proto = Triangulation.prototype;
    function removePair(list, j, k) {
      for (var i = 1, n = list.length; i < n; i += 2) {
        if (list[i - 1] === j && list[i] === k) {
          list[i - 1] = list[n - 2];
          list[i] = list[n - 1];
          list.length = n - 2;
          return;
        }
      }
    }
    proto.isConstraint = /* @__PURE__ */ (function() {
      var e = [0, 0];
      function compareLex(a, b) {
        return a[0] - b[0] || a[1] - b[1];
      }
      return function(i, j) {
        e[0] = Math.min(i, j);
        e[1] = Math.max(i, j);
        return bsearch.eq(this.edges, e, compareLex) >= 0;
      };
    })();
    proto.removeTriangle = function(i, j, k) {
      var stars = this.stars;
      removePair(stars[i], j, k);
      removePair(stars[j], k, i);
      removePair(stars[k], i, j);
    };
    proto.addTriangle = function(i, j, k) {
      var stars = this.stars;
      stars[i].push(j, k);
      stars[j].push(k, i);
      stars[k].push(i, j);
    };
    proto.opposite = function(j, i) {
      var list = this.stars[i];
      for (var k = 1, n = list.length; k < n; k += 2) {
        if (list[k] === j) {
          return list[k - 1];
        }
      }
      return -1;
    };
    proto.flip = function(i, j) {
      var a = this.opposite(i, j);
      var b = this.opposite(j, i);
      this.removeTriangle(i, j, a);
      this.removeTriangle(j, i, b);
      this.addTriangle(i, b, a);
      this.addTriangle(j, a, b);
    };
    proto.edges = function() {
      var stars = this.stars;
      var result = [];
      for (var i = 0, n = stars.length; i < n; ++i) {
        var list = stars[i];
        for (var j = 0, m = list.length; j < m; j += 2) {
          result.push([list[j], list[j + 1]]);
        }
      }
      return result;
    };
    proto.cells = function() {
      var stars = this.stars;
      var result = [];
      for (var i = 0, n = stars.length; i < n; ++i) {
        var list = stars[i];
        for (var j = 0, m = list.length; j < m; j += 2) {
          var s = list[j];
          var t = list[j + 1];
          if (i < Math.min(s, t)) {
            result.push([i, s, t]);
          }
        }
      }
      return result;
    };
    function createTriangulation(numVerts, edges) {
      var stars = new Array(numVerts);
      for (var i = 0; i < numVerts; ++i) {
        stars[i] = [];
      }
      return new Triangulation(stars, edges);
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/robust-in-sphere/in-sphere.js
var require_in_sphere = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/robust-in-sphere/in-sphere.js"(exports, module2) {
    "use strict";
    var twoProduct = require_two_product();
    var robustSum = require_robust_sum();
    var robustDiff = require_robust_diff();
    var robustScale = require_robust_scale();
    var NUM_EXPAND = 6;
    function orientation(n) {
      var fn = n === 3 ? inSphere3 : n === 4 ? inSphere4 : n === 5 ? inSphere5 : inSphere6;
      return fn(robustSum, robustDiff, twoProduct, robustScale);
    }
    function inSphere0() {
      return 0;
    }
    function inSphere1() {
      return 0;
    }
    function inSphere2() {
      return 0;
    }
    function inSphere3(sum, diff, prod, scale) {
      function exactInSphere3(m0, m1, m2) {
        var w0 = prod(m0[0], m0[0]);
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w1 = prod(m1[0], m1[0]);
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w2 = prod(m2[0], m2[0]);
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var p = sum(diff(w2m1, w1m2), diff(w1m0, w0m1));
        var n = diff(w2m0, w0m2);
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere3;
    }
    function inSphere4(sum, diff, prod, scale) {
      function exactInSphere4(m0, m1, m2, m3) {
        var w0 = sum(prod(m0[0], m0[0]), prod(m0[1], m0[1]));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w1 = sum(prod(m1[0], m1[0]), prod(m1[1], m1[1]));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w2 = sum(prod(m2[0], m2[0]), prod(m2[1], m2[1]));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w3 = sum(prod(m3[0], m3[0]), prod(m3[1], m3[1]));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var p = sum(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))));
        var n = sum(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere4;
    }
    function inSphere5(sum, diff, prod, scale) {
      function exactInSphere5(m0, m1, m2, m3, m4) {
        var w0 = sum(prod(m0[0], m0[0]), sum(prod(m0[1], m0[1]), prod(m0[2], m0[2])));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w0m4 = scale(w0, m4[0]);
        var w1 = sum(prod(m1[0], m1[0]), sum(prod(m1[1], m1[1]), prod(m1[2], m1[2])));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w1m4 = scale(w1, m4[0]);
        var w2 = sum(prod(m2[0], m2[0]), sum(prod(m2[1], m2[1]), prod(m2[2], m2[2])));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w2m4 = scale(w2, m4[0]);
        var w3 = sum(prod(m3[0], m3[0]), sum(prod(m3[1], m3[1]), prod(m3[2], m3[2])));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var w3m4 = scale(w3, m4[0]);
        var w4 = sum(prod(m4[0], m4[0]), sum(prod(m4[1], m4[1]), prod(m4[2], m4[2])));
        var w4m0 = scale(w4, m0[0]);
        var w4m1 = scale(w4, m1[0]);
        var w4m2 = scale(w4, m2[0]);
        var w4m3 = scale(w4, m3[0]);
        var p = sum(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]))), sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]), sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])))), sum(sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]))), sum(scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2]), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2])))));
        var n = sum(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere5;
    }
    function inSphere6(sum, diff, prod, scale) {
      function exactInSphere6(m0, m1, m2, m3, m4, m5) {
        var w0 = sum(sum(prod(m0[0], m0[0]), prod(m0[1], m0[1])), sum(prod(m0[2], m0[2]), prod(m0[3], m0[3])));
        var w0m1 = scale(w0, m1[0]);
        var w0m2 = scale(w0, m2[0]);
        var w0m3 = scale(w0, m3[0]);
        var w0m4 = scale(w0, m4[0]);
        var w0m5 = scale(w0, m5[0]);
        var w1 = sum(sum(prod(m1[0], m1[0]), prod(m1[1], m1[1])), sum(prod(m1[2], m1[2]), prod(m1[3], m1[3])));
        var w1m0 = scale(w1, m0[0]);
        var w1m2 = scale(w1, m2[0]);
        var w1m3 = scale(w1, m3[0]);
        var w1m4 = scale(w1, m4[0]);
        var w1m5 = scale(w1, m5[0]);
        var w2 = sum(sum(prod(m2[0], m2[0]), prod(m2[1], m2[1])), sum(prod(m2[2], m2[2]), prod(m2[3], m2[3])));
        var w2m0 = scale(w2, m0[0]);
        var w2m1 = scale(w2, m1[0]);
        var w2m3 = scale(w2, m3[0]);
        var w2m4 = scale(w2, m4[0]);
        var w2m5 = scale(w2, m5[0]);
        var w3 = sum(sum(prod(m3[0], m3[0]), prod(m3[1], m3[1])), sum(prod(m3[2], m3[2]), prod(m3[3], m3[3])));
        var w3m0 = scale(w3, m0[0]);
        var w3m1 = scale(w3, m1[0]);
        var w3m2 = scale(w3, m2[0]);
        var w3m4 = scale(w3, m4[0]);
        var w3m5 = scale(w3, m5[0]);
        var w4 = sum(sum(prod(m4[0], m4[0]), prod(m4[1], m4[1])), sum(prod(m4[2], m4[2]), prod(m4[3], m4[3])));
        var w4m0 = scale(w4, m0[0]);
        var w4m1 = scale(w4, m1[0]);
        var w4m2 = scale(w4, m2[0]);
        var w4m3 = scale(w4, m3[0]);
        var w4m5 = scale(w4, m5[0]);
        var w5 = sum(sum(prod(m5[0], m5[0]), prod(m5[1], m5[1])), sum(prod(m5[2], m5[2]), prod(m5[3], m5[3])));
        var w5m0 = scale(w5, m0[0]);
        var w5m1 = scale(w5, m1[0]);
        var w5m2 = scale(w5, m2[0]);
        var w5m3 = scale(w5, m3[0]);
        var w5m4 = scale(w5, m4[0]);
        var p = sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m2[2]), scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), -m5[2]))), m1[3]), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m5[2]))), -m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), -m5[2]))), m3[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m1[2]), scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m5[2]))), -m4[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]))), m5[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m5[2]))), m0[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m5[2]))), -m1[3])))), sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m4[2]), scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), -m5[2]))), m3[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m5[2]))), -m4[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]))), m5[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m1[2]), scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m5[2]))), m0[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m5[2]))), -m1[3]), scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m3[1]), scale(diff(w3m1, w1m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m5[2]))), m2[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m0[2]), scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m5[2]))), -m3[3]), scale(sum(sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2])), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2]))), m5[3])))));
        var n = sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m2[2]), scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), -m5[2]))), m0[3]), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m3[1]), sum(scale(diff(w5m3, w3m5), -m4[1]), scale(diff(w4m3, w3m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m3[2])), sum(scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), m4[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m5[2]))), -m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m5[2]))), m3[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m3, w3m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m3[1]), scale(diff(w3m2, w2m3), m5[1]))), m0[2]), scale(sum(scale(diff(w5m3, w3m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m3[1]), scale(diff(w3m0, w0m3), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m5[2]))), -m4[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), m5[3])), sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m1[2]), scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), -m5[2]))), m0[3]), scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m2[1]), sum(scale(diff(w5m2, w2m5), -m4[1]), scale(diff(w4m2, w2m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m2[2])), sum(scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), m4[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m5[2]))), -m1[3])))), sum(sum(sum(scale(sum(sum(scale(sum(scale(diff(w5m4, w4m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m4[1]), scale(diff(w4m1, w1m4), m5[1]))), m0[2]), scale(sum(scale(diff(w5m4, w4m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m4[1]), scale(diff(w4m0, w0m4), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m4[2]), scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), -m5[2]))), m2[3]), scale(sum(sum(scale(sum(scale(diff(w5m2, w2m5), m1[1]), sum(scale(diff(w5m1, w1m5), -m2[1]), scale(diff(w2m1, w1m2), m5[1]))), m0[2]), scale(sum(scale(diff(w5m2, w2m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m2[1]), scale(diff(w2m0, w0m2), m5[1]))), -m1[2])), sum(scale(sum(scale(diff(w5m1, w1m5), m0[1]), sum(scale(diff(w5m0, w0m5), -m1[1]), scale(diff(w1m0, w0m1), m5[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m5[2]))), -m4[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))), m5[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m1[2]), scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), -m4[2]))), m0[3]))), sum(sum(scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m2[1]), sum(scale(diff(w4m2, w2m4), -m3[1]), scale(diff(w3m2, w2m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m2[2])), sum(scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), m3[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m4[2]))), -m1[3]), scale(sum(sum(scale(sum(scale(diff(w4m3, w3m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m3[1]), scale(diff(w3m1, w1m3), m4[1]))), m0[2]), scale(sum(scale(diff(w4m3, w3m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m3[1]), scale(diff(w3m0, w0m3), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m3[2]), scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), -m4[2]))), m2[3])), sum(scale(sum(sum(scale(sum(scale(diff(w4m2, w2m4), m1[1]), sum(scale(diff(w4m1, w1m4), -m2[1]), scale(diff(w2m1, w1m2), m4[1]))), m0[2]), scale(sum(scale(diff(w4m2, w2m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m2[1]), scale(diff(w2m0, w0m2), m4[1]))), -m1[2])), sum(scale(sum(scale(diff(w4m1, w1m4), m0[1]), sum(scale(diff(w4m0, w0m4), -m1[1]), scale(diff(w1m0, w0m1), m4[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m4[2]))), -m3[3]), scale(sum(sum(scale(sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))), m0[2]), scale(sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))), -m1[2])), sum(scale(sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))), m2[2]), scale(sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))), -m3[2]))), m4[3])))));
        var d = diff(p, n);
        return d[d.length - 1];
      }
      return exactInSphere6;
    }
    var CACHED = [
      inSphere0,
      inSphere1,
      inSphere2
    ];
    function slowInSphere(args) {
      var proc2 = CACHED[args.length];
      if (!proc2) {
        proc2 = CACHED[args.length] = orientation(args.length);
      }
      return proc2.apply(void 0, args);
    }
    function proc(slow, o0, o1, o2, o3, o4, o5, o6) {
      function testInSphere(a0, a1, a2, a3, a4, a5) {
        switch (arguments.length) {
          case 0:
          case 1:
            return 0;
          case 2:
            return o2(a0, a1);
          case 3:
            return o3(a0, a1, a2);
          case 4:
            return o4(a0, a1, a2, a3);
          case 5:
            return o5(a0, a1, a2, a3, a4);
          case 6:
            return o6(a0, a1, a2, a3, a4, a5);
        }
        var s = new Array(arguments.length);
        for (var i = 0; i < arguments.length; ++i) {
          s[i] = arguments[i];
        }
        return slow(s);
      }
      return testInSphere;
    }
    function generateInSphereTest() {
      while (CACHED.length <= NUM_EXPAND) {
        CACHED.push(orientation(CACHED.length));
      }
      module2.exports = proc.apply(void 0, [slowInSphere].concat(CACHED));
      for (var i = 0; i <= NUM_EXPAND; ++i) {
        module2.exports[i] = CACHED[i];
      }
    }
    generateInSphereTest();
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/delaunay.js
var require_delaunay = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/delaunay.js"(exports, module2) {
    "use strict";
    var inCircle = require_in_sphere()[4];
    var bsearch = require_search_bounds();
    module2.exports = delaunayRefine;
    function testFlip(points, triangulation, stack, a, b, x) {
      var y = triangulation.opposite(a, b);
      if (y < 0) {
        return;
      }
      if (b < a) {
        var tmp = a;
        a = b;
        b = tmp;
        tmp = x;
        x = y;
        y = tmp;
      }
      if (triangulation.isConstraint(a, b)) {
        return;
      }
      if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
        stack.push(a, b);
      }
    }
    function delaunayRefine(points, triangulation) {
      var stack = [];
      var numPoints = points.length;
      var stars = triangulation.stars;
      for (var a = 0; a < numPoints; ++a) {
        var star = stars[a];
        for (var j = 1; j < star.length; j += 2) {
          var b = star[j];
          if (b < a) {
            continue;
          }
          if (triangulation.isConstraint(a, b)) {
            continue;
          }
          var x = star[j - 1], y = -1;
          for (var k = 1; k < star.length; k += 2) {
            if (star[k - 1] === b) {
              y = star[k];
              break;
            }
          }
          if (y < 0) {
            continue;
          }
          if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
            stack.push(a, b);
          }
        }
      }
      while (stack.length > 0) {
        var b = stack.pop();
        var a = stack.pop();
        var x = -1, y = -1;
        var star = stars[a];
        for (var i = 1; i < star.length; i += 2) {
          var s = star[i - 1];
          var t = star[i];
          if (s === b) {
            y = t;
          } else if (t === b) {
            x = s;
          }
        }
        if (x < 0 || y < 0) {
          continue;
        }
        if (inCircle(points[a], points[b], points[x], points[y]) >= 0) {
          continue;
        }
        triangulation.flip(a, b);
        testFlip(points, triangulation, stack, x, a, y);
        testFlip(points, triangulation, stack, a, y, x);
        testFlip(points, triangulation, stack, y, b, x);
        testFlip(points, triangulation, stack, b, x, y);
      }
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/filter.js
var require_filter = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/lib/filter.js"(exports, module2) {
    "use strict";
    var bsearch = require_search_bounds();
    module2.exports = classifyFaces;
    function FaceIndex(cells, neighbor, constraint, flags, active, next, boundary) {
      this.cells = cells;
      this.neighbor = neighbor;
      this.flags = flags;
      this.constraint = constraint;
      this.active = active;
      this.next = next;
      this.boundary = boundary;
    }
    var proto = FaceIndex.prototype;
    function compareCell(a, b) {
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    }
    proto.locate = /* @__PURE__ */ (function() {
      var key = [0, 0, 0];
      return function(a, b, c) {
        var x = a, y = b, z = c;
        if (b < c) {
          if (b < a) {
            x = b;
            y = c;
            z = a;
          }
        } else if (c < a) {
          x = c;
          y = a;
          z = b;
        }
        if (x < 0) {
          return -1;
        }
        key[0] = x;
        key[1] = y;
        key[2] = z;
        return bsearch.eq(this.cells, key, compareCell);
      };
    })();
    function indexCells(triangulation, infinity) {
      var cells = triangulation.cells();
      var nc = cells.length;
      for (var i = 0; i < nc; ++i) {
        var c = cells[i];
        var x = c[0], y = c[1], z = c[2];
        if (y < z) {
          if (y < x) {
            c[0] = y;
            c[1] = z;
            c[2] = x;
          }
        } else if (z < x) {
          c[0] = z;
          c[1] = x;
          c[2] = y;
        }
      }
      cells.sort(compareCell);
      var flags = new Array(nc);
      for (var i = 0; i < flags.length; ++i) {
        flags[i] = 0;
      }
      var active = [];
      var next = [];
      var neighbor = new Array(3 * nc);
      var constraint = new Array(3 * nc);
      var boundary = null;
      if (infinity) {
        boundary = [];
      }
      var index = new FaceIndex(
        cells,
        neighbor,
        constraint,
        flags,
        active,
        next,
        boundary
      );
      for (var i = 0; i < nc; ++i) {
        var c = cells[i];
        for (var j = 0; j < 3; ++j) {
          var x = c[j], y = c[(j + 1) % 3];
          var a = neighbor[3 * i + j] = index.locate(y, x, triangulation.opposite(y, x));
          var b = constraint[3 * i + j] = triangulation.isConstraint(x, y);
          if (a < 0) {
            if (b) {
              next.push(i);
            } else {
              active.push(i);
              flags[i] = 1;
            }
            if (infinity) {
              boundary.push([y, x, -1]);
            }
          }
        }
      }
      return index;
    }
    function filterCells(cells, flags, target) {
      var ptr = 0;
      for (var i = 0; i < cells.length; ++i) {
        if (flags[i] === target) {
          cells[ptr++] = cells[i];
        }
      }
      cells.length = ptr;
      return cells;
    }
    function classifyFaces(triangulation, target, infinity) {
      var index = indexCells(triangulation, infinity);
      if (target === 0) {
        if (infinity) {
          return index.cells.concat(index.boundary);
        } else {
          return index.cells;
        }
      }
      var side = 1;
      var active = index.active;
      var next = index.next;
      var flags = index.flags;
      var cells = index.cells;
      var constraint = index.constraint;
      var neighbor = index.neighbor;
      while (active.length > 0 || next.length > 0) {
        while (active.length > 0) {
          var t = active.pop();
          if (flags[t] === -side) {
            continue;
          }
          flags[t] = side;
          var c = cells[t];
          for (var j = 0; j < 3; ++j) {
            var f = neighbor[3 * t + j];
            if (f >= 0 && flags[f] === 0) {
              if (constraint[3 * t + j]) {
                next.push(f);
              } else {
                active.push(f);
                flags[f] = side;
              }
            }
          }
        }
        var tmp = next;
        next = active;
        active = tmp;
        next.length = 0;
        side = -side;
      }
      var result = filterCells(cells, flags, target);
      if (infinity) {
        return result.concat(index.boundary);
      }
      return result;
    }
  }
});

// tailor-unify-20261007/toolchain/node_modules/cdt2d/cdt2d.js
var require_cdt2d = __commonJS({
  "tailor-unify-20261007/toolchain/node_modules/cdt2d/cdt2d.js"(exports, module2) {
    "use strict";
    var monotoneTriangulate = require_monotone();
    var makeIndex = require_triangulation();
    var delaunayFlip = require_delaunay();
    var filterTriangulation = require_filter();
    module2.exports = cdt2d4;
    function canonicalizeEdge(e) {
      return [Math.min(e[0], e[1]), Math.max(e[0], e[1])];
    }
    function compareEdge(a, b) {
      return a[0] - b[0] || a[1] - b[1];
    }
    function canonicalizeEdges(edges) {
      return edges.map(canonicalizeEdge).sort(compareEdge);
    }
    function getDefault(options, property, dflt) {
      if (property in options) {
        return options[property];
      }
      return dflt;
    }
    function cdt2d4(points, edges, options) {
      if (!Array.isArray(edges)) {
        options = edges || {};
        edges = [];
      } else {
        options = options || {};
        edges = edges || [];
      }
      var delaunay = !!getDefault(options, "delaunay", true);
      var interior = !!getDefault(options, "interior", true);
      var exterior = !!getDefault(options, "exterior", true);
      var infinity = !!getDefault(options, "infinity", false);
      if (!interior && !exterior || points.length === 0) {
        return [];
      }
      var cells = monotoneTriangulate(points, edges);
      if (delaunay || interior !== exterior || infinity) {
        var triangulation = makeIndex(points.length, canonicalizeEdges(edges));
        for (var i = 0; i < cells.length; ++i) {
          var f = cells[i];
          triangulation.addTriangle(f[0], f[1], f[2]);
        }
        if (delaunay) {
          delaunayFlip(points, triangulation);
        }
        if (!exterior) {
          return filterTriangulation(triangulation, -1);
        } else if (!interior) {
          return filterTriangulation(triangulation, 1, infinity);
        } else if (infinity) {
          return filterTriangulation(triangulation, 0, infinity);
        } else {
          return triangulation.cells();
        }
      } else {
        return cells;
      }
    }
  }
});

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/paper-program.mjs
var paper_program_exports = {};
__export(paper_program_exports, {
  PROGRAM: () => PROGRAM,
  edgeLength: () => edgeLength,
  gradePaper: () => gradePaper,
  meshPaper: () => meshPaper,
  paperSummary: () => paperSummary
});
var import_cdt2d = __toESM(require_cdt2d(), 1);

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/core.mjs
var SCHEMA = "kaopu-sewing-graph@1";
var clone = (x) => JSON.parse(JSON.stringify(x));
var distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
var finite = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
var fail = (code, detail) => {
  throw new Error(`${code}: ${detail}`);
};
var len = (p, ids) => ids.slice(1).reduce((s, id, k) => s + distance(p.uvMm[id], p.uvMm[ids[k]]), 0);
var cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var on = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
var intersect = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
function directedEdge(spec2, end) {
  const p = spec2.panels.find((p2) => p2.id === end.panelId);
  if (!p) fail("MISSING_PANEL", end.panelId);
  const ids = p.edges[end.edge];
  if (!ids) fail("MISSING_EDGE", `${p.id}.${end.edge}`);
  return { panel: p, ids: end.reverse ? [...ids].reverse() : [...ids] };
}
function validate(spec2) {
  if (!spec2 || spec2.schema !== SCHEMA) fail("SCHEMA", `expected ${SCHEMA}`);
  if (spec2.units !== "mm") fail("UNITS", "explicit millimetres required");
  if (!Number.isInteger(spec2.revision) || spec2.revision < 1) fail("REVISION", "positive integer required");
  if (!Array.isArray(spec2.panels) || !spec2.panels.length || spec2.panels.length > 32) fail("PANELS", "1\u201332 panels required");
  for (const key of ["panels", "materials", "seams", "stages"]) {
    if (!Array.isArray(spec2[key])) fail("SCHEMA", `${key} array required`);
    const ids = spec2[key].map((p) => p.id);
    if (ids.some((x) => typeof x !== "string" || !x) || new Set(ids).size !== ids.length) fail("DUPLICATE_ID", key);
  }
  if (spec2.acceptance?.productionReady !== false || spec2.acceptance?.fitValidated !== false) fail("ACCEPTANCE", "learning input cannot pre-accept garment");
  let vertexCount = 0, triangleCount = 0;
  for (const m of spec2.materials) if (![m.densityKgM2, m.stretchCompliance, m.bendCompliance].every(Number.isFinite) || !(m.densityKgM2 > 0 && m.densityKgM2 < 10 && m.stretchCompliance >= 0 && m.bendCompliance >= 0) || m.calibrated !== false) fail("MATERIAL", "uncalibrated finite positive demo material required");
  for (const p of spec2.panels) {
    if (!p.source?.version || !p.source?.kind) fail("SOURCE", p.id);
    if (!spec2.materials.some((m) => m.id === p.materialId)) fail("MATERIAL_REFERENCE", p.id);
    if (!Array.isArray(p.uvMm) || p.uvMm.length < 3 || p.uvMm.length > 3e3 || p.uvMm.some((x) => !finite(x) || x.some((v) => Math.abs(v) > 2e3))) fail("MATERIAL_COORDINATES", p.id);
    const indices = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.uvMm.length);
    if (!Array.isArray(p.triangles) || !p.triangles.length || p.triangles.length > 6e3) fail("TRIANGLES", p.id);
    for (const tri of p.triangles) if (!indices(tri) || tri.length !== 3 || new Set(tri).size !== 3 || cross(...tri.map((i) => p.uvMm[i])) <= 1e-7) fail("TRIANGLE_AREA", p.id);
    const usedVertices = new Set(p.triangles.flat()), meshEdges = /* @__PURE__ */ new Map(), triIds = /* @__PURE__ */ new Set();
    for (const tri of p.triangles) {
      const key = [...tri].sort((a, b2) => a - b2).join(":");
      if (triIds.has(key)) fail("DUPLICATE_TRIANGLE", p.id);
      triIds.add(key);
      for (let i = 0; i < 3; i++) {
        const key2 = [tri[i], tri[(i + 1) % 3]].sort((a, b2) => a - b2).join(":");
        meshEdges.set(key2, (meshEdges.get(key2) || 0) + 1);
      }
    }
    if (usedVertices.size !== p.uvMm.length) fail("UNUSED_MATERIAL_POINT", p.id);
    if ([...meshEdges.values()].some((n) => n > 2)) fail("NONMANIFOLD_MATERIAL", p.id);
    if (!indices(p.boundary) || new Set(p.boundary).size !== p.boundary.length) fail("BOUNDARY", p.id);
    const b = p.boundary.map((i) => p.uvMm[i]);
    for (let i = 0; i < b.length; i++) for (let j = i + 2; j < b.length; j++) {
      if (i === 0 && j === b.length - 1) continue;
      if (intersect(b[i], b[(i + 1) % b.length], b[j], b[(j + 1) % b.length])) fail("BOUNDARY_INTERSECTION", p.id);
    }
    const cutEdges = new Set(p.boundary.map((a, i) => [a, p.boundary[(i + 1) % p.boundary.length]].sort((a2, b2) => a2 - b2).join(":")));
    for (const [key, count] of meshEdges) if (count === 1 !== cutEdges.has(key)) fail("CUT_MESH_BOUNDARY", p.id);
    for (const key of cutEdges) if (meshEdges.get(key) !== 1) fail("CUT_MESH_BOUNDARY", p.id);
    if (!p.edges || Object.values(p.edges).some((ids) => !indices(ids))) fail("EDGES", p.id);
    for (const ids of Object.values(p.edges)) for (let i = 1; i < ids.length; i++) if (!meshEdges.has([ids[i - 1], ids[i]].sort((a, b2) => a - b2).join(":"))) fail("SEAM_NOT_ON_MATERIAL", p.id);
    if (!p.placement || !Array.isArray(p.placement.translationMm) || p.placement.translationMm.length !== 3 || !p.placement.translationMm.every(Number.isFinite) || !Number.isFinite(p.placement.rotationYDeg)) fail("PLACEMENT", p.id);
    if (!Array.isArray(p.temporaryPins) || p.temporaryPins.some((i) => !Number.isInteger(i) || i < 0 || i >= p.uvMm.length)) fail("PINS", p.id);
    if (p.allowanceState !== "meshed_flat_unfolded" || !Number.isFinite(p.seamAllowanceMm) || p.seamAllowanceMm < 0) fail("ALLOWANCE", p.id);
    vertexCount += p.uvMm.length;
    triangleCount += p.triangles.length;
  }
  const stages2 = new Map(spec2.stages.map((s) => [s.id, s])), visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), owners = [];
  function visit(id) {
    if (!stages2.has(id)) fail("STAGE_REFERENCE", id);
    if (visiting.has(id)) fail("STAGE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const s = stages2.get(id);
    if (!Array.isArray(s.requires) || !Array.isArray(s.seams)) fail("STAGE_SCHEMA", id);
    s.requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const s of spec2.stages) {
    visit(s.id);
    for (const id of s.seams) {
      const seam = spec2.seams.find((x) => x.id === id);
      if (!seam || seam.stageId !== s.id) fail("SEAM_STAGE", id);
      owners.push(id);
    }
  }
  if (owners.length !== spec2.seams.length || new Set(owners).size !== owners.length) fail("SEAM_OWNERSHIP", "each seam belongs to one stage");
  const used = /* @__PURE__ */ new Set(), seamReports = [];
  for (const s of spec2.seams) {
    for (const endpoint of [s.a, s.b]) {
      if (typeof endpoint?.reverse !== "boolean") fail("DIRECTION", "explicit edge direction required");
      const k = `${endpoint.panelId}:${endpoint.edge}`;
      if (used.has(k)) fail("EDGE_REUSE", k);
      used.add(k);
    }
    const a = directedEdge(spec2, s.a), b = directedEdge(spec2, s.b), la = len(a.panel, a.ids), lb = len(b.panel, b.ids);
    if (la <= 0 || lb <= 0 || !Number.isFinite(s.easeMm) || Math.abs(lb - la - s.easeMm) > 0.1) fail("EASE_LENGTH", `${s.id}: B\u2212A must match declared ease, not rescale rest geometry`);
    if (Math.abs(s.easeMm) / la > 0.15) fail("EASE_LIMIT", "demo supports up to 15% declared ease");
    if (!Array.isArray(s.notches) || s.notches.length < 2) fail("NOTCHES", "two or more anchors required");
    if (a.ids.length !== b.ids.length) fail("SAMPLING", "R1 solver requires equal seam sample count; resampling is not implemented");
    for (const id of s.notches) {
      const na = a.panel.edgeNotches?.[s.a.edge]?.find((n) => n.id === id), nb = b.panel.edgeNotches?.[s.b.edge]?.find((n) => n.id === id);
      if (!na || !nb) fail("NOTCH_REFERENCE", `${s.id}.${id}`);
      if (![na.t, nb.t].every((t) => Number.isFinite(t) && t >= 0 && t <= 1)) fail("NOTCH_RANGE", s.id);
      const ta = s.a.reverse ? 1 - na.t : na.t, tb = s.b.reverse ? 1 - nb.t : nb.t;
      if (Math.abs(ta - tb) > 1e-6) fail("NOTCH_DIRECTION", `${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({ id: s.id, lengthAMm: la, lengthBMm: lb, easeMm: lb - la, pairCount: a.ids.length });
  }
  return { valid: true, vertexCount, triangleCount, panelCount: spec2.panels.length, seams: seamReports, productionReady: false };
}
function fingerprint(spec2) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(spec2)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r03/src/paper-program.mjs
var PROGRAM = "kaopu-teacher-shorts-grading@1";
var edgeLength = (p, key) => {
  const e = p.edges[key];
  return e.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[e[j]][k])), 0);
};
var inside = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
var segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function gradePaper(base, { legDeltaMm = 0, waistEaseMm = 0 } = {}) {
  if (!Number.isFinite(legDeltaMm) || legDeltaMm < -60 || legDeltaMm > 60 || !Number.isFinite(waistEaseMm) || waistEaseMm < 0 || waistEaseMm > 40) throw Error("\u4EC5\u652F\u6301\u88E4\u957F \u221260\u2026+60 mm\u3001\u8170\u53E3\u677E\u91CF 0\u202640 mm");
  const spec2 = clone(base), original = Object.fromEntries(base.panels.map((p) => [p.id, p])), panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  const waistSeams = spec2.seams.filter((s) => s.a.panelId.startsWith("wb_") && s.b.panelId.startsWith("pant_"));
  const waistKeys = (p) => waistSeams.filter((s) => s.b.panelId === p.id).map((s) => s.b.edge);
  const fractions = { front: base.source.measurementSnapshot.waist.frontArcMm / base.source.measurementSnapshot.waist.circumferenceMm, back: base.source.measurementSnapshot.waist.backArcMm / base.source.measurementSnapshot.waist.circumferenceMm };
  const totalTop = edgeLength(original.wb_front, "e6") + edgeLength(original.wb_back, "e0");
  if (!Number.isFinite(fractions.front) || !Number.isFinite(fractions.back)) {
    fractions.front = edgeLength(original.wb_front, "e6") / totalTop;
    fractions.back = 1 - fractions.front;
  }
  const operationRecords = [];
  for (const p of spec2.panels.filter((p2) => p2.id.startsWith("pant_"))) {
    const old = original[p.id], front = p.id.includes("_f_"), keys = waistKeys(p), length = keys.reduce((n, k) => n + edgeLength(old, k), 0), waistIds = keys.flatMap((k) => old.edges[k]), waistY = Math.min(...waistIds.map((i) => old.uvMm[i][1])), centerX = old.uvMm[waistIds.reduce((a, b) => Math.abs(old.uvMm[a][0]) > Math.abs(old.uvMm[b][0]) ? a : b)][0];
    const lowerSide = Object.values(old.edges).find((ids) => old.uvMm[ids[0]][0] === 0 && old.uvMm[ids.at(-1)][0] === 0);
    const hipY = Math.min(...lowerSide.map((i) => old.uvMm[i][1])), innerKey = { pant_f_l: "e8", pant_f_r: "e1", pant_b_l: "e1", pant_b_r: "e11" }[p.id], crotchY = Math.min(...old.edges[innerKey].map((i) => old.uvMm[i][1])), delta = waistEaseMm * fractions[front ? "front" : "back"] / 2;
    p.uvMm = old.uvMm.map(([x, y]) => {
      const f = Math.max(0, Math.min(1, (y - hipY) / (waistY - hipY)));
      return [x + (x - centerX) * delta / length * f, y + (y >= crotchY ? legDeltaMm * (y - crotchY) / -crotchY : 0)];
    });
    operationRecords.push({ panelId: p.id, legGradeBelowDatumMm: crotchY, waistGradeAboveDatumMm: hipY, waistNetAdditionMm: delta, mode: "piecewise-linear paper-coordinate grading; not 3D scale" });
  }
  if (waistEaseMm) {
    for (const p of spec2.panels.filter((p2) => p2.id.startsWith("wb_"))) {
      const old = original[p.id], front = p.id === "wb_front", topKey = front ? "e6" : "e0", seams = waistSeams.filter((s) => s.a.panelId === p.id).sort((a, b) => +a.a.edge.slice(1) - +b.a.edge.slice(1));
      const lengths = seams.map((s) => edgeLength(panels[s.b.panelId], s.b.edge) * edgeLength(old, s.a.edge) / edgeLength(original[s.b.panelId], s.b.edge));
      const top = edgeLength(old, topKey) + waistEaseMm * fractions[front ? "front" : "back"], bottom = lengths.reduce((a, b) => a + b, 0), h = 35, phi = (bottom - top) / h;
      if (phi <= 1e-3 || phi >= Math.PI) throw Error("\u8170\u5934\u5706\u5F27\u8D85\u51FA\u672C\u4F8B\u53EF\u652F\u6301\u8303\u56F4");
      const rt = top / phi, rb = rt + h, topIds = old.edges[topKey], xc = (old.uvMm[topIds[0]][0] + old.uvMm[topIds.at(-1)][0]) / 2;
      const point = (r, theta) => [xc + r * Math.sin(theta), r * Math.cos(theta) - rt * Math.cos(phi / 2)];
      const direction = front ? 1 : -1;
      let traveled = 0;
      for (let k = 0; k < seams.length; k++) {
        const ids = p.edges[seams[k].a.edge], length = lengths[k];
        ids.forEach((id, j) => {
          const t = (traveled + length * j / (ids.length - 1)) / bottom;
          p.uvMm[id] = point(rb, direction * (t - 0.5) * phi);
        });
        traveled += length;
      }
      const topDir = old.uvMm[topIds.at(-1)][0] > old.uvMm[topIds[0]][0] ? 1 : -1;
      topIds.forEach((id, j) => {
        p.uvMm[id] = point(rt, topDir * (j / (topIds.length - 1) - 0.5) * phi);
      });
      const other = Object.keys(p.edges).filter((k) => k !== topKey && !seams.some((s) => s.a.edge === k));
      for (const key of other) {
        const ids = p.edges[key], a = [...p.uvMm[ids[0]]], b = [...p.uvMm[ids.at(-1)]];
        ids.forEach((id, j) => p.uvMm[id] = a.map((x, k) => x + (b[k] - x) * j / (ids.length - 1)));
      }
    }
  }
  for (const s of spec2.seams) s.easeMm = edgeLength(panels[s.b.panelId], s.b.edge) - edgeLength(panels[s.a.panelId], s.a.edge);
  spec2.revision = 1;
  spec2.id = "kaopu-short-paper-" + legDeltaMm + "-" + waistEaseMm;
  spec2.source.onlineProgram = { id: PROGRAM, controls: { legDeltaMm, waistEaseMm }, operationRecords, meaning: "bounded own 2D grading of attributed six-panel teacher pattern; not complete official generator port", sourcePaperFingerprint: fingerprint(base) };
  return spec2;
}
function meshPaper(input, { step = 16 } = {}) {
  const spec2 = clone(input);
  for (const p of spec2.panels) {
    const boundary = p.boundary.map((i) => p.uvMm[i]), constraints = p.boundary.map((i, j) => [i, p.boundary[(j + 1) % p.boundary.length]]), xs = boundary.map((q) => q[0]), ys = boundary.map((q) => q[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), count = p.uvMm.length;
    let row = 0;
    for (let y = ymin + step * Math.sqrt(3) / 4; y < ymax; y += step * Math.sqrt(3) / 2, row++) for (let x = xmin + step / 2 + row % 2 * step / 2; x < xmax; x += step) {
      const q = [x, y];
      if (inside(q, boundary) && constraints.every(([a, b]) => segDist(q, p.uvMm[a], p.uvMm[b]) > step * 0.42)) p.uvMm.push(q);
    }
    p.triangles = (0, import_cdt2d.default)(p.uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    p.temporaryGuideMaterialIds = Array.from({ length: p.uvMm.length - count }, (_, i) => count + i);
    p.source.meshMethod = "cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained";
  }
  spec2.source.meshing = { method: "cdt2d@1.0.0 MIT", interiorSpacingMm: step, baseCurveChordDeviationMm: 0.25, all28SourceStitchesRetained: true };
  validate(spec2);
  return spec2;
}
function paperSummary(spec2) {
  return { program: spec2.source.onlineProgram, panels: spec2.panels.length, seams: spec2.seams.length, waistTopMm: edgeLength(spec2.panels.find((p) => p.id === "wb_front"), "e6") + edgeLength(spec2.panels.find((p) => p.id === "wb_back"), "e0"), particleCount: spec2.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: spec2.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: spec2.panels.reduce((n, p) => n + p.triangles.reduce((a, t) => {
    const [u, v, w] = t.map((i) => p.uvMm[i]);
    return a + Math.abs((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])) / 2;
  }, 0), 0) };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-program.mjs
var paper_program_exports2 = {};
__export(paper_program_exports2, {
  PROGRAM: () => PROGRAM2,
  edgeLength: () => edgeLength2,
  gradePaper: () => gradePaper2,
  meshPaper: () => meshPaper3,
  paperSummary: () => paperSummary2
});

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/core.mjs
var SCHEMA2 = "kaopu-sewing-graph@1";
var clone2 = (x) => JSON.parse(JSON.stringify(x));
var freeze = (o) => {
  if (o && typeof o === "object") {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
};
var distance2 = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
var finite2 = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
var fail2 = (code, detail) => {
  throw new Error(`${code}: ${detail}`);
};
var len2 = (p, ids) => ids.slice(1).reduce((s, id, k) => s + distance2(p.uvMm[id], p.uvMm[ids[k]]), 0);
var cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var on2 = (a, b, p) => Math.abs(cross2(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
var intersect2 = (a, b, c, d) => cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0 || on2(a, b, c) || on2(a, b, d) || on2(c, d, a) || on2(c, d, b);
function directedEdge2(spec2, end) {
  const p = spec2.panels.find((p2) => p2.id === end.panelId);
  if (!p) fail2("MISSING_PANEL", end.panelId);
  const ids = p.edges[end.edge];
  if (!ids) fail2("MISSING_EDGE", `${p.id}.${end.edge}`);
  return { panel: p, ids: end.reverse ? [...ids].reverse() : [...ids] };
}
function validate2(spec2) {
  if (!spec2 || spec2.schema !== SCHEMA2) fail2("SCHEMA", `expected ${SCHEMA2}`);
  if (spec2.units !== "mm") fail2("UNITS", "explicit millimetres required");
  if (!Number.isInteger(spec2.revision) || spec2.revision < 1) fail2("REVISION", "positive integer required");
  if (!Array.isArray(spec2.panels) || !spec2.panels.length || spec2.panels.length > 32) fail2("PANELS", "1\u201332 panels required");
  for (const key of ["panels", "materials", "seams", "stages"]) {
    if (!Array.isArray(spec2[key])) fail2("SCHEMA", `${key} array required`);
    const ids = spec2[key].map((p) => p.id);
    if (ids.some((x) => typeof x !== "string" || !x) || new Set(ids).size !== ids.length) fail2("DUPLICATE_ID", key);
  }
  if (spec2.acceptance?.productionReady !== false || spec2.acceptance?.fitValidated !== false) fail2("ACCEPTANCE", "learning input cannot pre-accept garment");
  let vertexCount = 0, triangleCount = 0;
  for (const m of spec2.materials) if (![m.densityKgM2, m.stretchCompliance, m.bendCompliance].every(Number.isFinite) || !(m.densityKgM2 > 0 && m.densityKgM2 < 10 && m.stretchCompliance >= 0 && m.bendCompliance >= 0) || m.calibrated !== false) fail2("MATERIAL", "uncalibrated finite positive demo material required");
  for (const p of spec2.panels) {
    if (!p.source?.version || !p.source?.kind) fail2("SOURCE", p.id);
    if (!spec2.materials.some((m) => m.id === p.materialId)) fail2("MATERIAL_REFERENCE", p.id);
    if (!Array.isArray(p.uvMm) || p.uvMm.length < 3 || p.uvMm.length > 3e3 || p.uvMm.some((x) => !finite2(x) || x.some((v) => Math.abs(v) > 2e3))) fail2("MATERIAL_COORDINATES", p.id);
    const indices = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.uvMm.length);
    if (!Array.isArray(p.triangles) || !p.triangles.length || p.triangles.length > 6e3) fail2("TRIANGLES", p.id);
    for (const tri of p.triangles) if (!indices(tri) || tri.length !== 3 || new Set(tri).size !== 3 || cross2(...tri.map((i) => p.uvMm[i])) <= 1e-7) fail2("TRIANGLE_AREA", p.id);
    const usedVertices = new Set(p.triangles.flat()), meshEdges = /* @__PURE__ */ new Map(), triIds = /* @__PURE__ */ new Set();
    for (const tri of p.triangles) {
      const key = [...tri].sort((a, b2) => a - b2).join(":");
      if (triIds.has(key)) fail2("DUPLICATE_TRIANGLE", p.id);
      triIds.add(key);
      for (let i = 0; i < 3; i++) {
        const key2 = [tri[i], tri[(i + 1) % 3]].sort((a, b2) => a - b2).join(":");
        meshEdges.set(key2, (meshEdges.get(key2) || 0) + 1);
      }
    }
    if (usedVertices.size !== p.uvMm.length) fail2("UNUSED_MATERIAL_POINT", p.id);
    if ([...meshEdges.values()].some((n) => n > 2)) fail2("NONMANIFOLD_MATERIAL", p.id);
    if (!indices(p.boundary) || new Set(p.boundary).size !== p.boundary.length) fail2("BOUNDARY", p.id);
    const b = p.boundary.map((i) => p.uvMm[i]);
    for (let i = 0; i < b.length; i++) for (let j = i + 2; j < b.length; j++) {
      if (i === 0 && j === b.length - 1) continue;
      if (intersect2(b[i], b[(i + 1) % b.length], b[j], b[(j + 1) % b.length])) fail2("BOUNDARY_INTERSECTION", p.id);
    }
    const cutEdges = new Set(p.boundary.map((a, i) => [a, p.boundary[(i + 1) % p.boundary.length]].sort((a2, b2) => a2 - b2).join(":")));
    for (const [key, count] of meshEdges) if (count === 1 !== cutEdges.has(key)) fail2("CUT_MESH_BOUNDARY", p.id);
    for (const key of cutEdges) if (meshEdges.get(key) !== 1) fail2("CUT_MESH_BOUNDARY", p.id);
    if (!p.edges || Object.values(p.edges).some((ids) => !indices(ids))) fail2("EDGES", p.id);
    for (const ids of Object.values(p.edges)) for (let i = 1; i < ids.length; i++) if (!meshEdges.has([ids[i - 1], ids[i]].sort((a, b2) => a - b2).join(":"))) fail2("SEAM_NOT_ON_MATERIAL", p.id);
    if (!p.placement || !Array.isArray(p.placement.translationMm) || p.placement.translationMm.length !== 3 || !p.placement.translationMm.every(Number.isFinite) || !Number.isFinite(p.placement.rotationYDeg)) fail2("PLACEMENT", p.id);
    if (!Array.isArray(p.temporaryPins) || p.temporaryPins.some((i) => !Number.isInteger(i) || i < 0 || i >= p.uvMm.length)) fail2("PINS", p.id);
    if (p.allowanceState !== "meshed_flat_unfolded" || !Number.isFinite(p.seamAllowanceMm) || p.seamAllowanceMm < 0) fail2("ALLOWANCE", p.id);
    vertexCount += p.uvMm.length;
    triangleCount += p.triangles.length;
  }
  const stages2 = new Map(spec2.stages.map((s) => [s.id, s])), visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), owners = [];
  function visit(id) {
    if (!stages2.has(id)) fail2("STAGE_REFERENCE", id);
    if (visiting.has(id)) fail2("STAGE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const s = stages2.get(id);
    if (!Array.isArray(s.requires) || !Array.isArray(s.seams)) fail2("STAGE_SCHEMA", id);
    s.requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const s of spec2.stages) {
    visit(s.id);
    for (const id of s.seams) {
      const seam = spec2.seams.find((x) => x.id === id);
      if (!seam || seam.stageId !== s.id) fail2("SEAM_STAGE", id);
      owners.push(id);
    }
  }
  if (owners.length !== spec2.seams.length || new Set(owners).size !== owners.length) fail2("SEAM_OWNERSHIP", "each seam belongs to one stage");
  const used = /* @__PURE__ */ new Set(), seamReports = [];
  for (const s of spec2.seams) {
    for (const endpoint of [s.a, s.b]) {
      if (typeof endpoint?.reverse !== "boolean") fail2("DIRECTION", "explicit edge direction required");
      const k = `${endpoint.panelId}:${endpoint.edge}`;
      if (used.has(k)) fail2("EDGE_REUSE", k);
      used.add(k);
    }
    const a = directedEdge2(spec2, s.a), b = directedEdge2(spec2, s.b), la = len2(a.panel, a.ids), lb = len2(b.panel, b.ids);
    if (la <= 0 || lb <= 0 || !Number.isFinite(s.easeMm) || Math.abs(lb - la - s.easeMm) > 0.1) fail2("EASE_LENGTH", `${s.id}: B\u2212A must match declared ease, not rescale rest geometry`);
    const sparse = spec2.source?.experimentalSparseSewing === true && s.numericalStitchPlan;
    if (sparse) {
      const pairs = s.stitchVertexPairs;
      if (!Array.isArray(pairs) || pairs.length < 2) fail2("SPARSE_STITCHES", s.id);
      let ai=-1, bi=-1;
      for (const pair of pairs) {
        if (!Array.isArray(pair)||pair.length!==2) fail2("SPARSE_PAIR",s.id);
        const ia=a.ids.indexOf(pair[0]),ib=b.ids.indexOf(pair[1]);
        if(ia<0||ib<0||ia<=ai||ib<=bi) fail2("SPARSE_DIRECTION",s.id);
        ai=ia;bi=ib;
      }
      if(pairs[0][0]!==a.ids[0]||pairs[0][1]!==b.ids[0]||pairs.at(-1)[0]!==a.ids.at(-1)||pairs.at(-1)[1]!==b.ids.at(-1))fail2("SPARSE_ENDPOINTS",s.id);
      if(!s.sourceSeam?.gathering||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientA)||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientB))fail2("ORIGINAL_GATHERING_REQUIRED",s.id);
    }
    if (Math.abs(s.easeMm) / la > 0.15 && !sparse) fail2("EASE_LIMIT", "demo supports up to 15% declared ease; R06 requires validated sparse stitch sites");
    if (!Array.isArray(s.notches) || s.notches.length < 2) fail2("NOTCHES", "two or more anchors required");
    if (!sparse && a.ids.length !== b.ids.length) fail2("SAMPLING", "R1 solver requires equal seam sample count; resampling is not implemented");
    for (const id of s.notches) {
      const na = a.panel.edgeNotches?.[s.a.edge]?.find((n) => n.id === id), nb = b.panel.edgeNotches?.[s.b.edge]?.find((n) => n.id === id);
      if (!na || !nb) fail2("NOTCH_REFERENCE", `${s.id}.${id}`);
      if (![na.t, nb.t].every((t) => Number.isFinite(t) && t >= 0 && t <= 1)) fail2("NOTCH_RANGE", s.id);
      const ta = s.a.reverse ? 1 - na.t : na.t, tb = s.b.reverse ? 1 - nb.t : nb.t;
      if (Math.abs(ta - tb) > 1e-6) fail2("NOTCH_DIRECTION", `${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({ id: s.id, lengthAMm: la, lengthBMm: lb, easeMm: lb - la, pairCount: a.ids.length });
  }
  return { valid: true, vertexCount, triangleCount, panelCount: spec2.panels.length, seams: seamReports, productionReady: false };
}
function fingerprint2(spec2) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(spec2)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function cut(spec2) {
  validate2(spec2);
  return freeze({ schema: "kaopu-cut-snapshot@1", signature: fingerprint2(spec2), revision: spec2.revision, spec: clone2(spec2), productionReady: false });
}
var ClothLab = class {
  constructor(snapshot) {
    if (snapshot?.schema !== "kaopu-cut-snapshot@1" || snapshot.signature !== fingerprint2(snapshot.spec)) fail2("SNAPSHOT", "valid immutable cut snapshot required");
    validate2(snapshot.spec);
    this.snapshot = freeze(clone2(snapshot));
    this.spec = this.snapshot.spec;
    this.positions = [];
    this.previous = [];
    this.velocity = [];
    this.invMass = [];
    this.baseInvMass = [];
    this.offsets = /* @__PURE__ */ new Map();
    this.constraints = [];
    this.seamConstraints = [];
    this.triangles = [];
    this.pins = /* @__PURE__ */ new Map();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.active = /* @__PURE__ */ new Set();
    this.elapsed = 0;
    this.seamElapsed = 0;
    this.seamDetached = false;
    this.gravity = true;
    this.obstacle = false;
    this.pull = false;
    this.sphere = { center: [0, -0.025, -0.02], radius: 0.052 };
    this.floorY = -0.3;
    this.pullDirections = [];
    for (const p of this.spec.panels) {
      const start = this.positions.length;
      this.offsets.set(p.id, start);
      const theta = p.placement.rotationYDeg * Math.PI / 180, m = specMaterial(this.spec, p), mass = new Array(p.uvMm.length).fill(0), panelIndex = this.spec.panels.indexOf(p);
      for (const tri of p.triangles) {
        const area = cross2(...tri.map((i) => p.uvMm[i])) / 2e6;
        tri.forEach((i) => mass[i] += area * m.densityKgM2 / 3);
        this.triangles.push({ ids: tri.map((i) => start + i), uv: tri.map((i) => p.uvMm[i]), panelId: p.id });
      }
      for (let i = 0; i < p.uvMm.length; i++) {
        const [u, v] = p.uvMm[i], t = p.placement.translationMm;
        const point = [(u * Math.cos(theta) + t[0]) / 1e3, (t[1] - v) / 1e3, (u * Math.sin(theta) + t[2]) / 1e3];
        this.positions.push(point);
        this.previous.push([...point]);
        this.velocity.push([0, 0, 0]);
        this.invMass.push(1 / mass[i]);
        this.baseInvMass.push(1 / mass[i]);
        this.pullDirections.push(panelIndex === 0 ? -1 : panelIndex === this.spec.panels.length - 1 ? 1 : 0);
      }
      for (const i of p.temporaryPins) {
        this.pins.set(start + i, [...this.positions[start + i]]);
        this.invMass[start + i] = 0;
      }
      const edges = /* @__PURE__ */ new Map();
      for (const tri of p.triangles) for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3], key = [a, b].sort((a2, b2) => a2 - b2).join(":");
        if (!edges.has(key)) edges.set(key, { a, b, opposite: [] });
        edges.get(key).opposite.push(tri[(i + 2) % 3]);
      }
      for (const e of edges.values()) {
        this.constraints.push({ a: start + e.a, b: start + e.b, rest: distance2(p.uvMm[e.a], p.uvMm[e.b]) / 1e3, compliance: m.stretchCompliance, lambda: 0, type: "stretch" });
        if (e.opposite.length === 2) {
          const [a, b] = e.opposite;
          this.constraints.push({ a: start + a, b: start + b, rest: distance2(p.uvMm[a], p.uvMm[b]) / 1e3, compliance: m.bendCompliance, lambda: 0, type: "bend-distance-proxy" });
        }
      }
    }
  }
  assertCurrent(spec2) {
    if (fingerprint2(spec2) !== this.snapshot.signature) fail2("STALE_CUT", "pattern/material/placement changed: cut and sew again");
  }
  activate(stageId, current = this.spec) {
    this.assertCurrent(current);
    const stage = this.spec.stages.find((s) => s.id === stageId);
    if (!stage) fail2("STAGE_REFERENCE", stageId);
    if (stage.requires.some((id) => !this.completed.has(id))) fail2("STAGE_DEPENDENCY", stageId);
    if (this.completed.has(stageId)) return;
    for (const id of stage.seams) {
      const seam = this.spec.seams.find((s) => s.id === id), a = directedEdge2(this.spec, seam.a), b = directedEdge2(this.spec, seam.b);
      const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      for (const pair of pairs) {
        const ia = this.offsets.get(a.panel.id) + pair[0], ib = this.offsets.get(b.panel.id) + pair[1];
        this.seamConstraints.push({ a: ia, b: ib, rest: 8e-4, startRest: distance2(this.positions[ia], this.positions[ib]), activatedAt: this.elapsed, compliance: 1e-8, lambda: 0, type: "seam", seamId: id });
      }
      this.active.add(id);
    }
    this.seamElapsed = 0;
    this.completed.add(stageId);
  }
  releasePins() {
    this.pins.clear();
    this.invMass = [...this.baseInvMass];
  }
  detach() {
    this.seamConstraints = [];
    this.active.clear();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.seamDetached = true;
  }
  step(dt = 1 / 60) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) fail2("TIMESTEP", "positive timestep up to 0.05 seconds required");
    const sub3 = 3, h = dt / sub3;
    for (let substep = 0; substep < sub3; substep++) {
      this.elapsed += h;
      this.seamElapsed += h;
      for (let i = 0; i < this.positions.length; i++) {
        this.previous[i] = [...this.positions[i]];
        if (!this.invMass[i]) continue;
        const v = this.velocity[i], p = this.positions[i];
        v[1] -= (this.gravity ? 9.81 : 0) * h;
        if (this.pull) v[0] += this.pullDirections[i] * 2.2 * h;
        for (let k = 0; k < 3; k++) p[k] += v[k] * h;
      }
      const constraints = [...this.constraints, ...this.seamConstraints];
      constraints.forEach((c) => c.lambda = 0);
      for (let iter = 0; iter < 12; iter++) {
        for (const c of constraints) {
          const a = this.positions[c.a], b = this.positions[c.b], w1 = this.invMass[c.a], w2 = this.invMass[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], d = Math.hypot(dx, dy, dz);
          if (d < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / 1.2) : c.rest;
          const dl = (-(d - target) - alpha * c.lambda) / (w1 + w2 + alpha);
          c.lambda += dl;
          const f = dl / d;
          for (let k = 0; k < 3; k++) {
            const n = [dx, dy, dz][k];
            a[k] += w1 * f * n;
            b[k] -= w2 * f * n;
          }
        }
        for (let i = 0; i < this.positions.length; i++) {
          if (!this.invMass[i]) continue;
          const p = this.positions[i];
          p[1] = Math.max(this.floorY, p[1]);
          if (this.obstacle) {
            const c = this.sphere.center, d = distance2(p, c), r = this.sphere.radius + 1e-3;
            if (d < r) {
              const n = d > 1e-10 ? p.map((x, k) => (x - c[k]) / d) : [0, 0, 1];
              for (let k = 0; k < 3; k++) p[k] = c[k] + n[k] * r;
            }
          }
        }
      }
      const decay = Math.exp(-3 * h);
      for (let i = 0; i < this.positions.length; i++) for (let k = 0; k < 3; k++) this.velocity[i][k] = (this.positions[i][k] - this.previous[i][k]) / h * decay;
    }
  }
  metrics() {
    let maxStrain = 0, minRatio = 1, finite3 = true, maxSpeed = 0, penetration = 0;
    for (const t of this.triangles) {
      const [u0, u1, u2] = t.uv, du = u1[0] - u0[0], dv = u1[1] - u0[1], eu = u2[0] - u0[0], ev = u2[1] - u0[1], det = du * ev - dv * eu;
      const [p0, p1, p2] = t.ids.map((i) => this.positions[i]), f1 = [], f2 = [];
      for (let k = 0; k < 3; k++) {
        const a = (p1[k] - p0[k]) * 1e3, b = (p2[k] - p0[k]) * 1e3;
        f1.push((a * ev - b * dv) / det);
        f2.push((-a * eu + b * du) / det);
      }
      const aa = f1.reduce((s2, x) => s2 + x * x, 0), bb = f2.reduce((s2, x) => s2 + x * x, 0), ab = f1.reduce((s2, x, k) => s2 + x * f2[k], 0), disc = Math.sqrt((aa - bb) ** 2 + 4 * ab * ab);
      const large = Math.sqrt(Math.max(0, (aa + bb + disc) / 2)), small = Math.sqrt(Math.max(0, (aa + bb - disc) / 2));
      maxStrain = Math.max(maxStrain, large - 1, 1 - small);
      minRatio = Math.min(minRatio, small);
    }
    for (let i = 0; i < this.positions.length; i++) {
      finite3 &&= this.positions[i].every(Number.isFinite);
      maxSpeed = Math.max(maxSpeed, Math.hypot(...this.velocity[i]));
      if (this.obstacle) penetration = Math.max(penetration, (this.sphere.radius + 1e-3 - distance2(this.positions[i], this.sphere.center)) * 1e3);
    }
    const s = this.spec.seams.flatMap((seam) => {
      const a = directedEdge2(this.spec, seam.a), b = directedEdge2(this.spec, seam.b);
      const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);return pairs.map(([id,other])=>distance2(this.positions[this.offsets.get(a.panel.id)+id],this.positions[this.offsets.get(b.panel.id)+other])*1e3);
    });
    return { finite: finite3, maxPrincipalStrain: maxStrain, minStretchRatio: minRatio, maxSeamGapMm: Math.max(0, ...s), meanSeamGapMm: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), maxSpeedMmS: maxSpeed * 1e3, maxVertexSpherePenetrationMm: Math.max(0, penetration), pins: this.pins.size, activeStitches: this.seamConstraints.length, vertexCount: this.positions.length, triangleCount: this.triangles.length, restSignature: this.snapshot.signature, elapsed: this.elapsed, bodyContact: "not_implemented", selfCollision: "not_implemented", productionReady: false };
  }
  export() {
    return { schema: "kaopu-cloth-experiment@1", snapshot: this.snapshot, positionsMm: this.positions.map((p) => p.map((x) => x * 1e3)), activeSeams: [...this.active], temporaryPins: [...this.pins.keys()], metrics: this.metrics(), solver: { type: "distance-XPBD", version: "r1", bending: "uncalibrated-distance-proxy", contacts: "vertex-sphere-and-floor-only", continuousCollision: false, selfCollision: false }, productionReady: false };
  }
};
function specMaterial(spec2, p) {
  return spec2.materials.find((m) => m.id === p.materialId);
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-mesher.mjs
var import_cdt2d2 = __toESM(require_cdt2d(), 1);
var edgeLength2 = (p, key) => {
  const e = p.edges[key];
  return e.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[e[j]][k])), 0);
};
var inside2 = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
var segDist2 = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function meshPaper2(input, { step = 16 } = {}) {
  const spec2 = clone2(input);
  for (const p of spec2.panels) {
    const boundary = p.boundary.map((i) => p.uvMm[i]), constraints = p.boundary.map((i, j) => [i, p.boundary[(j + 1) % p.boundary.length]]), xs = boundary.map((q) => q[0]), ys = boundary.map((q) => q[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), count = p.uvMm.length;
    let row = 0;
    for (let y = ymin + step * Math.sqrt(3) / 4; y < ymax; y += step * Math.sqrt(3) / 2, row++) for (let x = xmin + step / 2 + row % 2 * step / 2; x < xmax; x += step) {
      const q = [x, y];
      if (inside2(q, boundary) && constraints.every(([a, b]) => segDist2(q, p.uvMm[a], p.uvMm[b]) > step * 0.42)) p.uvMm.push(q);
    }
    p.triangles = (0, import_cdt2d2.default)(p.uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    p.temporaryGuideMaterialIds = Array.from({ length: p.uvMm.length - count }, (_, i) => count + i);
    p.source.meshMethod = "cdt2d@1.0.0 MIT, 16 mm interior spacing; updated 2D boundaries retained";
  }
  spec2.source.meshing = { method: "cdt2d@1.0.0 MIT", interiorSpacingMm: step, baseCurveChordDeviationMm: 0.25, allSourceStitchesRetained: true, sourceStitchCount: input.seams.length };
  validate2(spec2);
  return spec2;
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/paper-program.mjs
var PROGRAM2 = "kaopu-teacher-sleeveless-top-grading@1";
function gradePaper2(base, { bodyLengthDeltaMm = 0, hemEaseMm = 0 } = {}) {
  if (!Number.isFinite(bodyLengthDeltaMm) || bodyLengthDeltaMm < -50 || bodyLengthDeltaMm > 80 || !Number.isFinite(hemEaseMm) || hemEaseMm < 0 || hemEaseMm > 120) throw Error("\u672C\u4F8B\u652F\u6301\u8863\u957F \u221250\u2026+80 mm\u3001\u4E0B\u6446\u65B0\u589E\u677E\u91CF 0\u2026120 mm");
  const spec2 = clone2(base), records = [];
  for (const p of spec2.panels) {
    const old = base.panels.find((x) => x.id === p.id), side = spec2.seams.find((s) => s.stageId === "sides" && (s.a.panelId === p.id || s.b.panelId === p.id));
    if (!side) throw Error("\u4E0A\u8863\u4FA7\u7F1D\u7F3A\u5931");
    const endpoint = side.a.panelId === p.id ? side.a : side.b, datum = Math.min(...old.edges[endpoint.edge].map((i) => old.uvMm[i][1])), width = Math.max(...old.uvMm.map((q) => Math.abs(q[0]))), sign = p.source.side === "L" ? 1 : -1;
    p.uvMm = old.uvMm.map(([x, y]) => {
      const w = Math.max(0, Math.min(1, (y - datum) / -datum));
      return [x + sign * hemEaseMm / 4 * (Math.abs(x) / width) * w, y + bodyLengthDeltaMm * w];
    });
    records.push({ panelId: p.id, operation: "extend lower torso and spread the hem below the underarm datum", datumYmm: datum, lengthDeltaMm: bodyLengthDeltaMm, hemAdditionPerPanelMm: hemEaseMm / 4, unchanged: "neck, shoulder, complete armhole, and material above underarm datum" });
  }
  const panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  for (const s of spec2.seams) s.easeMm = edgeLength2(panels[s.b.panelId], s.b.edge) - edgeLength2(panels[s.a.panelId], s.a.edge);
  spec2.id = `kaopu-sleeveless-top-${bodyLengthDeltaMm}-${hemEaseMm}`;
  spec2.revision = 1;
  spec2.source.onlineProgram = { id: PROGRAM2, controls: { bodyLengthDeltaMm, hemEaseMm }, operationRecords: records, sourcePaperFingerprint: fingerprint2(base), meaning: "bounded original 2D alterations of four-panel MIT teacher paper; fixed adult synthetic body; no solved 3D garment input" };
  return spec2;
}
function meshPaper3(input, options) {
  const s = meshPaper2(input, options);
  delete s.source.meshing.all28SourceStitchesRetained;
  s.source.meshing.sourceStitchCount = input.seams.length;
  s.source.meshing.allSourceStitchesRetained = s.seams.length === input.seams.length;
  return s;
}
function paperSummary2(spec2) {
  let area = 0, hem = 0;
  for (const p of spec2.panels) {
    for (const t of p.triangles) {
      const [a, b, c] = t.map((i) => p.uvMm[i]);
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    }
    const maxY = Math.max(...p.uvMm.map((q) => q[1]));
    const h = Object.entries(p.edges).find(([, ids]) => ids.every((i) => Math.abs(p.uvMm[i][1] - maxY) < 1e-7));
    if (!h) throw Error("\u4E0B\u6446\u6C34\u5E73\u8FB9\u7F3A\u5931");
    hem += edgeLength2(p, h[0]);
  }
  return { program: spec2.source.onlineProgram, panels: spec2.panels.length, seams: spec2.seams.length, hemCircumferenceMm: hem, particleCount: spec2.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: spec2.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: area };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r05/src/paper-program.mjs
var paper_program_exports3 = {};
__export(paper_program_exports3, {
  PROGRAM: () => PROGRAM3,
  edgeLength: () => edgeLength3,
  gradePaper: () => gradePaper3,
  paperSummary: () => paperSummary3
});
var PROGRAM3 = "kaopu-short-sleeve-template-grading@1";
var edgeLength3 = (p, key) => {
  const ids = p.edges[key];
  return ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0);
};
function gradePaper3(base, { bodyLengthDeltaMm = 0, sleeveLengthDeltaMm = 0 } = {}) {
  if (!Number.isFinite(bodyLengthDeltaMm) || bodyLengthDeltaMm < -50 || bodyLengthDeltaMm > 80 || !Number.isFinite(sleeveLengthDeltaMm) || sleeveLengthDeltaMm < -30 || sleeveLengthDeltaMm > 50) throw Error("\u672C\u4F8B\u652F\u6301\u8863\u957F \u221250\u2026+80 mm\u3001\u8896\u957F \u221230\u2026+50 mm");
  const spec2 = clone2(base), records = [];
  for (const p of spec2.panels) {
    const old = base.panels.find((x) => x.id === p.id), role = p.source.role;
    if (role.startsWith("torso")) {
      const side = spec2.seams.find((s) => s.stageId === "sides" && (s.a.panelId === p.id || s.b.panelId === p.id)), e = side.a.panelId === p.id ? side.a : side.b, datum = Math.min(...old.edges[e.edge].map((i) => old.uvMm[i][1]));
      p.uvMm = bodyLengthDeltaMm ? old.uvMm.map(([x, y]) => [x, y + bodyLengthDeltaMm * Math.max(0, Math.min(1, (y - datum) / -datum))]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, datumYmm: datum, bodyLengthDeltaMm, operation: "grade every original material point below underarm datum; curved edges held fixed" });
    } else if (role.startsWith("sleeve")) {
      const caps = spec2.seams.filter((s) => s.stageId === "armholes" && (s.a.panelId === p.id || s.b.panelId === p.id)), ids = caps.flatMap((s) => {
        const e = s.a.panelId === p.id ? s.a : s.b;
        return old.edges[e.edge];
      }), datum = Math.min(...ids.map((i) => Math.abs(old.uvMm[i][0]))), direction = p.source.side === "L" ? 1 : -1;
      p.uvMm = sleeveLengthDeltaMm ? old.uvMm.map(([x, y]) => [x + direction * sleeveLengthDeltaMm * Math.max(0, Math.min(1, (datum - Math.abs(x)) / datum)), y]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, capNearestAbsoluteXmm: datum, sleeveLengthDeltaMm, operation: "extend distal straight sleeve material strip; complete source sleeve cap held fixed" });
    } else throw Error("Unknown material role");
    for (const key of Object.keys(p.analyticCurvesMm || {})) for (const id of p.edges[key]) if (Math.hypot(...p.uvMm[id].map((x, k) => x - old.uvMm[id][k])) > 1e-8) throw Error("Grading unexpectedly moved a protected analytic curve");
  }
  const panels = Object.fromEntries(spec2.panels.map((p) => [p.id, p]));
  for (const s of spec2.seams) s.easeMm = edgeLength3(panels[s.b.panelId], s.b.edge) - edgeLength3(panels[s.a.panelId], s.a.edge);
  let minimum = 180, area = 0;
  for (const p of spec2.panels) for (const t of p.triangles) {
    const q = t.map((i) => p.uvMm[i]), D = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (D <= 1e-8) throw Error("\u4E8C\u7EF4\u653E\u7801\u4F7F\u6750\u6599\u4E09\u89D2\u5F62\u7FFB\u8F6C");
    area += D / 2;
    for (let i = 0; i < 3; i++) {
      const a = q[(i + 1) % 3].map((x, k) => x - q[i][k]), b = q[(i + 2) % 3].map((x, k) => x - q[i][k]);
      minimum = Math.min(minimum, Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI);
    }
  }
  if (minimum < 15) throw Error("\u653E\u7801\u540E\u7F51\u683C\u8D28\u91CF\u8D85\u51FA\u672C\u4F8B\u9650\u5236");
  spec2.id = `kaopu-short-sleeve-${bodyLengthDeltaMm}-${sleeveLengthDeltaMm}`;
  spec2.revision = 1;
  spec2.source.onlineProgram = { id: PROGRAM3, controls: { bodyLengthDeltaMm, sleeveLengthDeltaMm }, sourcePaperFingerprint: fingerprint2(base), operationRecords: records, meaning: "bounded 2D material grading with fixed template connectivity; fresh solve from flat material, not new Delaunay or 3D scaling" };
  spec2.source.meshing = { ...spec2.source.meshing, onlineRemeshing: false, connectivityRetained: true, minimumGradedTriangleAngleDeg: minimum, gradedMaterialAreaMm2: area };
  validate2(spec2);
  return spec2;
}
function paperSummary3(s) {
  let hem = 0;
  for (const p of s.panels.filter((p2) => p2.source.role.startsWith("torso"))) {
    const ymax = Math.max(...p.uvMm.map((q) => q[1])), h = Object.entries(p.edges).find(([, ids]) => ids.every((i) => Math.abs(p.uvMm[i][1] - ymax) < 1e-7));
    if (!h) throw Error("Missing material hem");
    hem += edgeLength3(p, h[0]);
  }
  return { program: s.source.onlineProgram, panels: s.panels.length, seams: s.seams.length, hemCircumferenceMm: hem, particleCount: s.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: s.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: s.source.meshing.gradedMaterialAreaMm2, minimumTriangleAngleDeg: s.source.meshing.minimumGradedTriangleAngleDeg, connectivityRetained: true };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/stitch-groups.mjs
var StitchGroups = class {
  constructor(lab2) {
    this.lab = lab2;
    this.parent = lab2.positions.map((_, i) => i);
    this.representatives = [...this.parent];
    this.groupCount = this.parent.length;
    this.equalities = 0;
  }
  find(i) {
    return this.parent[i] === i ? i : this.parent[i] = this.find(this.parent[i]);
  }
  synchronize() {
    const l = this.lab;
    let changed = false;
    for (const c of l.seamConstraints) {
      if (c.eliminated || l.elapsed - c.activatedAt < c.rampDuration) continue;
      const a = this.find(c.a), b = this.find(c.b);
      if (a === b) {
        c.eliminated = true;
        continue;
      }
      const pa = l.positions[a], pb = l.positions[b], gap = Math.hypot(...pa.map((x, k) => x - pb[k]));
      if (gap > 2e-3) continue;
      this.parent[Math.max(a, b)] = Math.min(a, b);
      c.eliminated = true;
      this.equalities++;
      changed = true;
    }
    if (changed) this.rebuild();
    return changed;
  }
  rebuild() {
    const l = this.lab, groups = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.parent.length; i++) {
      const r = this.find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    this.representatives = [...groups.keys()];
    this.groupCount = groups.size;
    this.groups = groups;
    for (const [root2, ids] of groups) {
      let mass = 0;
      const p = [0, 0, 0], v = [0, 0, 0], pins = ids.filter((i) => l.pins.has(i));
      for (const i of ids) {
        const m = 1 / l.baseInvMass[i];
        mass += m;
        for (let k = 0; k < 3; k++) {
          p[k] += l.positions[i][k] * m;
          v[k] += l.velocity[i][k] * m;
        }
      }
      for (let k = 0; k < 3; k++) {
        p[k] = pins.length ? pins.reduce((sum, i) => sum + l.positions[i][k], 0) / pins.length : p[k] / mass;
        v[k] /= mass;
      }
      for (const i of ids) {
        l.positions[i] = p;
        l.velocity[i] = v;
        l.invMass[i] = pins.length ? 0 : 1 / mass;
      }
    }
  }
  report() {
    return { mode: "ideal-zero-width-stitch equality elimination", materialParticles: this.parent.length, solverGroups: this.groupCount, mergedEqualities: this.equalities, restMetricChanged: false, materialIdsPreserved: true, totalMaterialMassKg: this.lab.baseInvMass.reduce((s, w) => s + 1 / w, 0), fixedSolverGroups: this.representatives.filter((i) => this.lab.invMass[i] === 0).length };
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/self-contact.mjs
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function closest(p, a, b, c, out) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  let u = 0, v = 0, w = 0;
  if (d1 <= 0 && d2 <= 0) u = 1;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) v = 1;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        v = d1 / (d1 - d3);
        u = 1 - v;
      } else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) w = 1;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            w = d2 / (d2 - d6);
            u = 1 - w;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              w = (d4 - d3) / (d4 - d3 + (d5 - d6));
              v = 1 - w;
            } else {
              const den = 1 / (va + vb + vc);
              v = vb * den;
              w = vc * den;
              u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  out[0] = a[0] * u + b[0] * v + c[0] * w;
  out[1] = a[1] * u + b[1] * v + c[1] * w;
  out[2] = a[2] * u + b[2] * v + c[2] * w;
  out[3] = u;
  out[4] = v;
  out[5] = w;
  return out;
}
var SelfContact = class {
  constructor(lab2, { thicknessMm = 0.6, cellSizeMm = 25 } = {}) {
    this.lab = lab2;
    this.h = thicknessMm / 1e3;
    this.cell = cellSizeMm / 1e3;
    this.neighbours = Array.from({ length: lab2.positions.length }, (_, i) => /* @__PURE__ */ new Set([i]));
    for (const [a, b] of lab2.meshEdges) {
      this.neighbours[a].add(b);
      this.neighbours[b].add(a);
    }
    this.hash = /* @__PURE__ */ new Map();
    this.q = new Float64Array(6);
    this.corrections = 0;
    this.skippedLargeTriangles = 0;
    this.groupNeighbours = null;
    this.lastGroupCount = -1;
  }
  key(x, y, z) {
    return x + 128 + 512 * (y + 128) + 262144 * (z + 128);
  }
  rebuild() {
    const l = this.lab;
    if (l.stitchEqualityElimination && this.lastGroupCount !== l.stitchGroups.groupCount) {
      this.groupNeighbours = /* @__PURE__ */ new Map();
      for (let i = 0; i < this.neighbours.length; i++) {
        const r = l.stitchGroups.find(i);
        if (!this.groupNeighbours.has(r)) this.groupNeighbours.set(r, /* @__PURE__ */ new Set());
        for (const j of this.neighbours[i]) this.groupNeighbours.get(r).add(l.stitchGroups.find(j));
      }
      this.lastGroupCount = l.stitchGroups.groupCount;
    }
    this.hash.clear();
    const ps = this.lab.positions, s = this.cell, pad = this.h * 3 + (this.lab.lastMaxSubstepDisplacement || 0) * 3;
    for (let t = 0; t < this.lab.triangles.length; t++) {
      const ids = this.lab.triangles[t].ids, a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
      const x0 = Math.floor((Math.min(a[0], b[0], c[0]) - pad) / s), x1 = Math.floor((Math.max(a[0], b[0], c[0]) + pad) / s), y0 = Math.floor((Math.min(a[1], b[1], c[1]) - pad) / s), y1 = Math.floor((Math.max(a[1], b[1], c[1]) + pad) / s), z0 = Math.floor((Math.min(a[2], b[2], c[2]) - pad) / s), z1 = Math.floor((Math.max(a[2], b[2], c[2]) + pad) / s);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 3e3) {
        this.skippedLargeTriangles++;
        continue;
      }
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const key = this.key(x, y, z);
        let list = this.hash.get(key);
        if (!list) {
          list = [];
          this.hash.set(key, list);
        }
        list.push(t);
      }
    }
  }
  project() {
    const l = this.lab, ps = l.positions, im = l.invMass, h = this.h, q = this.q, s = this.cell;
    let total = 0;
    for (let i = 0; i < ps.length; i++) {
      if (l.stitchEqualityElimination && l.stitchGroups.find(i) !== i) continue;
      const p = ps[i], list = this.hash.get(this.key(Math.floor(p[0] / s), Math.floor(p[1] / s), Math.floor(p[2] / s)));
      if (!list) continue;
      const near = l.stitchEqualityElimination ? this.groupNeighbours.get(l.stitchGroups.find(i)) : this.neighbours[i];
      for (const t of list) {
        const ids = l.triangles[t].ids, topological = l.stitchEqualityElimination ? ids.map((j) => l.stitchGroups.find(j)) : ids;
        if (near.has(topological[0]) || near.has(topological[1]) || near.has(topological[2])) continue;
        const a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
        closest(p, a, b, c, q);
        let dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], len3 = Math.hypot(dx, dy, dz), n;
        const fn = cross3(sub(b, a), sub(c, a)), fnLen = Math.hypot(...fn);
        if (fnLen < 1e-15) continue;
        const N = fn.map((v) => v / fnLen), currentSigned = dot(sub(p, a), N), old = l._old, prevP = [old[i * 3], old[i * 3 + 1], old[i * 3 + 2]], oldA = [old[ids[0] * 3], old[ids[0] * 3 + 1], old[ids[0] * 3 + 2]], oldB = [old[ids[1] * 3], old[ids[1] * 3 + 1], old[ids[1] * 3 + 2]], oldC = [old[ids[2] * 3], old[ids[2] * 3 + 1], old[ids[2] * 3 + 2]], pn = cross3(sub(oldB, oldA), sub(oldC, oldA)), pnLen = Math.hypot(...pn), previousSigned = pnLen ? dot(sub(prevP, oldA), pn) / pnLen : currentSigned, projectedDistance = Math.hypot(dx - currentSigned * N[0], dy - currentSigned * N[1], dz - currentSigned * N[2]);
        const crossed = previousSigned * currentSigned < 0 && projectedDistance < h && pnLen > 1e-15 && dot(pn, N) > 0;
        if (len3 >= h && !crossed) continue;
        let penetration;
        if (crossed) {
          const side = previousSigned >= 0 ? 1 : -1;
          n = N.map((v) => v * side);
          penetration = h - side * currentSigned;
        } else if (len3 > 1e-9) {
          n = [dx / len3, dy / len3, dz / len3];
          penetration = h - len3;
        } else {
          n = N;
          if (previousSigned < 0) n = n.map((v) => -v);
          penetration = h;
        }
        let den = im[i];
        for (let k = 0; k < 3; k++) den += im[ids[k]] * q[k + 3] * q[k + 3];
        if (den < 1e-12) continue;
        const dl = penetration / den, fp = im[i] * dl;
        for (let k = 0; k < 3; k++) p[k] += n[k] * fp;
        for (let k = 0; k < 3; k++) {
          const v = ps[ids[k]], f = im[ids[k]] * q[k + 3] * dl;
          v[0] -= n[0] * f;
          v[1] -= n[1] * f;
          v[2] -= n[2] * f;
        }
        total++;
      }
    }
    this.corrections += total;
    return total;
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/unified/physics/reference-optimized.mjs
var norm3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
var BodySDF = class {
  constructor(meta, array) {
    this.meta = meta;
    this.a = array;
  }
  sample(x, y, z, out) {
    const m = this.meta, d = m.dimensions, ox = m.originMm, step = m.spacingMm, fx = (x * 1e3 - ox[0]) / step, fy = (y * 1e3 - ox[1]) / step, fz = (z * 1e3 - ox[2]) / step;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= d[0] - 1 || fy >= d[1] - 1 || fz >= d[2] - 1) {
      out[0] = 1e3;
      out[1] = out[2] = out[3] = 0;
      out[4] = 0;
      return out;
    }
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k, nx = d[0], ny = d[1], o = (k * ny + j) * nx + i, a = this.a;
    const p = a[o], q = a[o + 1], r = a[o + nx], s = a[o + nx + 1], t = a[o + nx * ny], b = a[o + nx * ny + 1], c = a[o + nx * ny + nx], e = a[o + nx * ny + nx + 1];
    const lo = (p * (1 - u) + q * u) * (1 - v) + (r * (1 - u) + s * u) * v, hi = (t * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
    out[0] = (lo * (1 - w) + hi * w) * m.quantizationMm * 1e-3;
    const dx = ((q - p) * (1 - v) + (s - r) * v) * (1 - w) + ((b - t) * (1 - v) + (e - c) * v) * w, dy = ((r - p) * (1 - u) + (s - q) * u) * (1 - w) + ((c - t) * (1 - u) + (e - b) * u) * w, dz = hi - lo, n = norm3(dx, dy, dz);
    out[1] = n ? dx / n : 0;
    out[2] = n ? dy / n : 1;
    out[3] = n ? dz / n : 0;
    out[4] = 1;
    return out;
  }
};
var GarmentLab = class extends ClothLab {
  constructor(spec2, sdf2, { substeps = 18, iterations = 3, sewingDuration = 4, clearanceMm = 3.5 } = {}) {
    super(cut(spec2));
    this.sdf = sdf2;
    this.substeps = substeps;
    this.iterations = iterations;
    this.sewingDuration = sewingDuration;
    this.clearance = clearanceMm * 1e-3;
    this.gravityScale = 0;
    this.collisions = true;
    this.bodyContacts = 0;
    this._q = new Float64Array(5);
    this._old = new Float64Array(this.positions.length * 3);
    this.support = [];
    this.orientationGuides = true;
    this.guideSigns = new Int8Array(this.positions.length);
    for (const p of this.spec.panels) {
      if (p.placement.rigidBasis) {
        const o = this.offsets.get(p.id), b = p.placement.rigidBasis, t = p.placement.translationMm;
        for (let j = 0; j < p.uvMm.length; j++) {
          const [u, v] = p.uvMm[j];
          this.positions[o + j] = [(b[0] * u + b[1] * v + t[0]) / 1e3, (b[3] * u + b[4] * v + t[1]) / 1e3, (b[6] * u + b[7] * v + t[2]) / 1e3];
          this.previous[o + j] = [...this.positions[o + j]];
        }
      }
      if (p.meshType === "unstructured") {
        const off = this.offsets.get(p.id);
        for (const i of p.temporaryGuideMaterialIds) this.guideSigns[off + i] = p.source.bodySide === "front" || p.id.includes("F") ? 1 : -1;
      } else if (p.id !== "G") {
        const off = this.offsets.get(p.id), isFront = p.id.includes("F"), cols = p.meshGrid?.columns ?? 13, rows = p.uvMm.length / cols, j0 = p.meshGrid?.guideRows[0] ?? 1, j1 = p.meshGrid?.guideRows[1] ?? rows - 2, i0 = p.meshGrid?.guideColumns[0] ?? 2, i1 = p.meshGrid?.guideColumns[1] ?? cols - 3;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.guideSigns[off + j * cols + i] = isFront ? 1 : -1;
      }
      for (const index of p.temporaryPins) {
        if (p.temporaryPinTargetsMm?.[index]) {
          const id2 = this.offsets.get(p.id) + index;
          this.support.push({ id: id2, start: [...this.positions[id2]], target: p.temporaryPinTargetsMm[index].map((x) => x / 1e3) });
          continue;
        }
        const id = this.offsets.get(p.id) + index, sign = p.id.endsWith("R") ? -1 : 1, start = [...this.positions[id]], waist = this.spec.source.measurementSnapshot.lowerWaist || this.spec.source.measurementSnapshot.waist;
        const isCenter = this.spec.source.waistFixtures && index === p.edges.waist[0], back = p.id.startsWith("B"), target = isCenter ? [sign * 4e-4, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (back ? waist.backZ - 3.8 : waist.frontZ + 3.8) / 1e3] : [sign * (Math.abs(waist.sideRightXZ[0]) + 3.8) / 1e3, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (waist.sideRightXZ[1] + (back ? -0.4 : 0.4)) / 1e3];
        this.support.push({ id, start, target });
      }
    }
    this.strainTriangles = this.triangles.map((t) => {
      const [a, b, c] = t.uv.map((x) => x.map((y) => y / 1e3)), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu;
      return { ids: t.ids, c: [(dv - ev) / det, ev / det, -dv / det], d: [(eu - du) / det, -eu / det, du / det] };
    });
    this.meshEdges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const t of this.triangles) for (let i = 0; i < 3; i++) {
      const a = t.ids[i], b = t.ids[(i + 1) % 3], key = a < b ? a + ":" + b : b + ":" + a;
      if (!seen.has(key)) {
        seen.add(key);
        this.meshEdges.push([a, b]);
      }
    }
    this.selfContacts = new SelfContact(this);
    this.selfCollisionEnabled = true;
    this.stitchGroups = new StitchGroups(this);
    this.stitchEqualityElimination = false;
    this.strainGuard = true;
    this.frameCount = 0;
    this.actions = [];
  }
  activate(stageId, current = this.spec) {
    const existed = this.completed.has(stageId);
    super.activate(stageId, current);
    if (!existed) this.actions.push({ kind: "sew-stage", stageId, atFrame: this.frameCount });
    for (const c of this.seamConstraints) if (c.rampDuration === void 0) c.rampDuration = this.sewingDuration;
  }
  detach() {
    super.detach();
    this.actions.push({ kind: "detach", atFrame: this.frameCount });
    this.positions = this.positions.map((p) => [...p]);
    this.velocity = this.velocity.map((p) => [...p]);
    this.invMass = this.baseInvMass.map((w, i) => this.pins.has(i) ? 0 : w);
    this.stitchGroups = new StitchGroups(this);
  }
  setGravity(scale) {
    this.gravityScale = scale;
    this.actions.push({ kind: "gravity", scale, atFrame: this.frameCount });
  }
  releasePins() {
    super.releasePins();
    this.actions.push({ kind: "release-supports", atFrame: this.frameCount });
    this.support = [];
    this.orientationGuides = false;
    if (this.stitchEqualityElimination) this.stitchGroups.rebuild();
  }
  contact(ids, weights, margin = this.clearance) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], w = weights[k];
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
    }
    const q = this.sdf.sample(x, y, z, this._q);
    if (!q[4] || q[0] >= margin) return;
    let sum = 0;
    for (let k = 0; k < ids.length; k++) sum += this.invMass[ids[k]] * weights[k] * weights[k];
    if (sum < 1e-12) return;
    const lambda = (margin - q[0]) / sum;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], f = this.invMass[ids[k]] * weights[k] * lambda;
      p[0] += q[1] * f;
      p[1] += q[2] * f;
      p[2] += q[3] * f;
    }
    this.bodyContacts++;
  }
  strainLimit() {
    const ps = this.positions, im = this.invMass;
    for (const t of this.strainTriangles) {
      const [a, b, c] = t.ids, A = ps[a], B = ps[b], C = ps[c], u = t.c, w = t.d;
      let ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2], uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2], uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2], vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2], vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2], vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
      const aa = ux * ux + uy * uy + uz * uz, bb = vx * vx + vy * vy + vz * vz, ab = ux * vx + uy * vy + uz * vz;
      const radius = Math.abs(ab);
      if (Math.min(aa, bb) - radius >= 0.985 * 0.985 + 1e-12 && Math.max(aa, bb) + radius <= 1.015 * 1.015 - 1e-12) continue;
      const angle = 0.5 * Math.atan2(2 * ab, aa - bb), co = Math.cos(angle), si = Math.sin(angle);
      for (let mode = 0; mode < 2; mode++) {
        if (mode) {
          ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2];
          uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2];
          uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2];
          vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2];
          vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2];
          vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
        }
        const qx = mode ? -si : co, qy = mode ? co : si, nx = ux * qx + vx * qy, ny = uy * qx + vy * qy, nz = uz * qx + vz * qy, len3 = norm3(nx, ny, nz), target = Math.max(0.985, Math.min(1.015, len3));
        if (Math.abs(len3 - target) < 1e-6 || len3 < 1e-9) continue;
        const ca = u[0] * qx + w[0] * qy, cb = u[1] * qx + w[1] * qy, cc = u[2] * qx + w[2] * qy, den = im[a] * ca * ca + im[b] * cb * cb + im[c] * cc * cc;
        if (den < 1e-12) continue;
        const factor = -(len3 - target) / (den * len3), fa = im[a] * ca * factor, fb = im[b] * cb * factor, fc = im[c] * cc * factor;
        A[0] += fa * nx;
        A[1] += fa * ny;
        A[2] += fa * nz;
        B[0] += fb * nx;
        B[1] += fb * ny;
        B[2] += fb * nz;
        C[0] += fc * nx;
        C[1] += fc * ny;
        C[2] += fc * nz;
      }
    }
  }
  step(dt = 1 / 60) {
    this.frameCount++;
    const n = this.positions.length, h = dt / this.substeps, ps = this.positions, vs = this.velocity, im = this.invMass, q = this._q, old = this._old, all = [...this.constraints, ...this.seamConstraints];
    this.bodyContacts = 0;
    for (let sub3 = 0; sub3 < this.substeps; sub3++) {
      this.elapsed += h;
      this.seamElapsed += h;
      if (this.stitchEqualityElimination) this.stitchGroups.synchronize();
      for (const hold of this.support) {
        const p = ps[hold.id], t = Math.min(1, this.elapsed / 4), s = t * t * (3 - 2 * t);
        for (let k = 0; k < 3; k++) p[k] = hold.start[k] + (hold.target[k] - hold.start[k]) * s;
      }
      for (let i = 0; i < n; i++) {
        const p = ps[i], o = i * 3;
        old[o] = p[0];
        old[o + 1] = p[1];
        old[o + 2] = p[2];
      }
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i];
        if (!im[i]) continue;
        v[1] -= 9.81 * this.gravityScale * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
        p[2] += v[2] * h;
      }
      for (const c of all) c.lambda = 0;
      for (let iter = 0; iter < this.iterations; iter++) {
        for (const c of all) {
          if (c.eliminated) continue;
          const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len3 = norm3(dx, dy, dz);
          if (len3 < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration) : c.rest, dl = (-(len3 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len3;
          c.lambda += dl;
          a[0] += w1 * f * dx;
          a[1] += w1 * f * dy;
          a[2] += w1 * f * dz;
          b[0] -= w2 * f * dx;
          b[1] -= w2 * f * dy;
          b[2] -= w2 * f * dz;
        }
        if (this.strainGuard) this.strainLimit();
        if (this.orientationGuides) for (let i = 0; i < n; i++) {
          const sign = this.guideSigns[i];
          if (!sign || !im[i]) continue;
          const p = ps[i], y = p[1] * 1e3, m = this.spec.source.measurementSnapshot, split = y >= m.hip.heightMm ? m.hip.sideRightXZ[1] + (m.waist.sideRightXZ[1] - m.hip.sideRightXZ[1]) * Math.min(1, (y - m.hip.heightMm) / (m.waist.heightMm - m.hip.heightMm)) : 25, limit = (split + sign * 12) / 1e3;
          if (sign > 0 && p[2] < limit) p[2] = limit;
          if (sign < 0 && p[2] > limit) p[2] = limit;
        }
        if (this.collisions) for (let i = 0; i < n; i++) {
          if (!im[i]) continue;
          const p = ps[i];
          this.sdf.sample(p[0], p[1], p[2], q);
          if (q[4] && q[0] < this.clearance) {
            const d = this.clearance - q[0];
            p[0] += q[1] * d;
            p[1] += q[2] * d;
            p[2] += q[3] * d;
            this.bodyContacts++;
          }
        }
      }
      for (const c of this.seamConstraints) {
        if (c.eliminated) continue;
        const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len3 = norm3(dx, dy, dz);
        if (len3 < 1e-12 || w1 + w2 === 0) continue;
        const target = c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration), alpha = c.compliance / (h * h), dl = (-(len3 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len3;
        c.lambda += dl;
        a[0] += w1 * f * dx;
        a[1] += w1 * f * dy;
        a[2] += w1 * f * dz;
        b[0] -= w2 * f * dx;
        b[1] -= w2 * f * dy;
        b[2] -= w2 * f * dz;
      }
      if (this.collisions && sub3 % 3 === 2) {
        for (const e of this.meshEdges) this.contact(e, [0.5, 0.5], 15e-4);
        for (const t of this.triangles) this.contact(t.ids, [1 / 3, 1 / 3, 1 / 3], 15e-4);
      }
      if (this.selfCollisionEnabled && sub3 % 3 === 2) {
        let maxDelta = 0;
        for (let i = 0; i < n; i++) {
          const p = ps[i], o = i * 3;
          maxDelta = Math.max(maxDelta, Math.hypot(p[0] - old[o], p[1] - old[o + 1], p[2] - old[o + 2]));
        }
        this.lastMaxSubstepDisplacement = maxDelta;
        this.selfContacts.rebuild();
        this.selfContacts.project();
      }
      const damping = Math.exp(-20 * h);
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i], o = i * 3;
        v[0] = (p[0] - old[o]) / h * damping;
        v[1] = (p[1] - old[o + 1]) / h * damping;
        v[2] = (p[2] - old[o + 2]) / h * damping;
        if (p[1] < 0) {
          p[1] = 0;
          v[1] = 0;
        }
      }
    }
  }
  metrics() {
    const m = super.metrics();
    let minBody = Infinity, bad = 0, domain = 0, minY = Infinity, maxY = -Infinity;
    const q = new Float64Array(5);
    for (const p of this.positions) {
      this.sdf.sample(...p, q);
      if (q[4]) {
        minBody = Math.min(minBody, q[0] * 1e3);
        if (q[0] < -5e-4) bad++;
      } else domain++;
      minY = Math.min(minY, p[1] * 1e3);
      maxY = Math.max(maxY, p[1] * 1e3);
    }
    const seams = this.spec.seams.map((s) => {
      const a = directedEdge2(this.spec, s.a), b = directedEdge2(this.spec, s.b), o1 = this.offsets.get(a.panel.id), o2 = this.offsets.get(b.panel.id);
      const pairs=this.spec.source?.experimentalSparseSewing?s.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      const distances = pairs.map(([v,w]) => Math.hypot(...this.positions[o1 + v].map((x, k) => x - this.positions[o2 + w][k])) * 1e3);
      return { id: s.id, active: this.active.has(s.id), maxGapMm: Math.max(...distances), measurement: this.spec.source?.experimentalSparseSewing ? "numerical stitch sites, not every free gathering vertex" : "all paired edge vertices", stitchCount:pairs.length };
    });
    return { ...m, bodySignedDistanceMinMm: minBody, bodyInsideVertexCount: bad, outsideCollisionDomain: domain, minYmm: minY, maxYmm: maxY, seams, activeMaxGapMm: Math.max(0, ...seams.filter((s) => s.active).map((s) => s.maxGapMm)), temporarySupportCount: this.support.length, stitchEqualityElimination: this.stitchEqualityElimination ? this.stitchGroups.report() : false, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "grid-SDF from exact Anny triangle nearest distance; exact audit required", selfCollision: this.selfCollisionEnabled ? "discrete vertex-face, exact audit still required" : "disabled", selfContactCorrections: this.selfContacts.corrections, skippedSelfContactTriangles: this.selfContacts.skippedLargeTriangles };
  }
  export() {
    const m = this.metrics();
    return { ...super.export(), schema: "kaopu-garment-physical-trial@1", frameCount: this.frameCount, actions: this.actions, materialToSolverGroup: this.stitchEqualityElimination ? this.positions.map((_, i) => this.stitchGroups.find(i)) : this.positions.map((_, i) => i), metrics: m, solver: { ...super.export().solver, version: "garment-small-step-r1", contacts: "triangle-body-SDF vertex/edge/face samples and ground", strainGuard: this.strainGuard ? { kind: "per-iteration principal stretch clamp", min: 0.985, max: 1.015, acceptanceThreshold: false } : false, velocityDampingRate: 20, substeps: this.substeps, iterations: this.iterations, sewingDuration: this.sewingDuration, clearanceMm: this.clearance * 1e3, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "sampled triangle-mesh SDF + edge midpoint and face centroid projections", selfCollision: this.selfCollisionEnabled, stitchEqualities: this.stitchEqualityElimination ? this.stitchGroups.report() : false }, sourceBody: this.spec.source.measurementSnapshot.bodyId };
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/unified/physics/fast-solver.mjs
var module;
function configureWasm(bytes2) {
  module = new WebAssembly.Module(bytes2);
  return { bytes: bytes2.byteLength };
}
var GarmentLab2 = class extends GarmentLab {
  constructor(spec2, sdf2, options = {}) {
    super(spec2, sdf2, options);
    if (!module) throw Error("Fast kernel must be initialized before constructing cloth");
    this.kernel = new WebAssembly.Instance(module, { math: { atan2: Math.atan2, cos: Math.cos, sin: Math.sin } }).exports;
    this.profile = { distanceMs: 0, strainMs: 0, bodyVertexMs: 0, bodySurfaceMs: 0, integrateAndGroupsMs: 0 };
    const n = this.positions.length, t = this.strainTriangles.length, e = this.meshEdges.length, capacity = this.constraints.length + spec2.seams.reduce((s, x) => s + spec2.panels.find((p2) => p2.id === x.a.panelId).edges[x.a.edge].length, 0) + 16;
    this.capacity = capacity;
    let offset = 65536;
    const take = (count, bytes2 = 8) => {
      offset = Math.ceil(offset / 8) * 8;
      const p2 = offset;
      offset += count * bytes2;
      return p2;
    };
    this.ptr = { pos: take(n * 3), vel: take(n * 3), old: take(n * 3), inv: take(n), alias: take(n, 4), ci: take(capacity * 2, 4), cf: take(capacity * 10), ti: take(t * 3, 4), tf: take(t * 6), edges: take(e * 2, 4), sdf: take(sdf2.a.length, 2), rhs:take(n*3),sol:take(n*3),res:take(n*3),dir:take(n*3),ap:take(n*3),z:take(n*4),diag:take(n),qn:take(n*3*31),qgi:take(t*3*4,4),qgm:take(t*3) };
    if (offset > 128 * 1024 * 1024) throw Error("Kernel material memory limit exceeded");
    const memory = this.kernel.memory;
    memory.grow(Math.ceil(offset / 65536) - memory.buffer.byteLength / 65536);
    const b = memory.buffer, p = this.ptr;
    this.posViews = Array.from({ length: n }, (_, i) => new Float64Array(b, p.pos + i * 24, 3));
    this.velViews = Array.from({ length: n }, (_, i) => new Float64Array(b, p.vel + i * 24, 3));
    this.weights = new Float64Array(b, p.inv, n);
    this.alias = new Int32Array(b, p.alias, n);
    this.ci = new Int32Array(b, p.ci, capacity * 2);
    this.cf = new Float64Array(b, p.cf, capacity * 10);
    this._old = new Float64Array(b, p.old, n * 3);
    const tids = new Int32Array(b, p.ti, t * 3), coefs = new Float64Array(b, p.tf, t * 6), edgeIds = new Int32Array(b, p.edges, e * 2), field = new Int16Array(b, p.sdf, sdf2.a.length);
    field.set(sdf2.a);
    sdf2.a = field;
    for (let i = 0; i < t; i++) {
      tids.set(this.strainTriangles[i].ids, i * 3);
      coefs.set([...this.strainTriangles[i].c, ...this.strainTriangles[i].d], i * 6);
    }
    for (let i = 0; i < e; i++) edgeIds.set(this.meshEdges[i], i * 2);
    const m = sdf2.meta;
    this.kernel.configure(p.pos, p.inv, p.alias, p.ci, p.cf, p.ti, p.tf, p.edges, p.sdf, n, 0, t, e, ...m.dimensions, ...m.originMm, m.spacingMm, m.quantizationMm);
    this.kernel.configureGlobal(p.rhs,p.sol,p.res,p.dir,p.ap,p.z,p.diag);
    this.packGroups();
    this.wrapRebuild();
    this.syncConstraints();
  }
  wrapRebuild() {
    const rebuild = this.stitchGroups.rebuild.bind(this.stitchGroups);
    this.stitchGroups.rebuild = () => {
      rebuild();
      this.packGroups();
    };
  }
  packGroups() {
    const positions = this.positions, velocity = this.velocity, weights = this.invMass;
    for (let i = 0; i < positions.length; i++) {
      const r = this.stitchGroups.find(i);
      this.alias[i] = r;
      this.posViews[r].set(positions[i]);
      this.velViews[r].set(velocity[i]);
      this.weights[i] = weights[i];
    }
    for (let i = 0; i < positions.length; i++) {
      positions[i] = this.posViews[this.alias[i]];
      velocity[i] = this.velViews[this.alias[i]];
    }
    this.invMass = this.weights;
  }
  syncConstraints() {
    const all = [...this.constraints, ...this.seamConstraints];
    if (all.length > this.capacity) throw Error("Constraint capacity exceeded");
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      this.ci[i * 2] = c.a;
      this.ci[i * 2 + 1] = c.b;
      this.cf.set([c.rest, c.compliance, c.startRest || 0, c.activatedAt || 0, c.rampDuration || 1, 0, c.eliminated ? 1 : 0, c.type === "seam" ? 1 : 0, 0, 0], i * 10);
    }
    this.count = all.length;
    this.kernel.setConstraintCount(all.length);
  }
  activate(stageId, current = this.spec) {
    super.activate(stageId, current);
    if (this.kernel) this.syncConstraints();
  }
  releasePins() {
    super.releasePins();
    if (!this.stitchEqualityElimination) this.packGroups();
  }
  detach() {
    super.detach();
    this.wrapRebuild();
    this.packGroups();
    this.syncConstraints();
  }
  step(dt = 1 / 60) {
    if (this.orientationGuides || this.selfCollisionEnabled) return super.step(dt);
    this.frameCount++;
    const n = this.positions.length, h = dt / this.substeps, ps = this.positions, vs = this.velocity, im = this.invMass, old = this._old, k = this.kernel, P = this.profile, baseCount = this.constraints.length;
    this.bodyContacts = 0;
    for (let sub3 = 0; sub3 < this.substeps; sub3++) {
      let now = performance.now();
      this.elapsed += h;
      this.seamElapsed += h;
      if (this.stitchEqualityElimination) this.stitchGroups.synchronize();
      for (let j = 0; j < this.seamConstraints.length; j++) this.cf[(baseCount + j) * 10 + 6] = this.seamConstraints[j].eliminated ? 1 : 0;
      for (const hold of this.support) {
        const p = ps[hold.id], t = Math.min(1, this.elapsed / .75), s = t * t * (3 - 2 * t);
        for (let axis = 0; axis < 3; axis++) p[axis] = hold.start[axis] + (hold.target[axis] - hold.start[axis]) * s;
      }
      for (let i = 0; i < n; i++) {
        const p = ps[i], o = i * 3;
        old[o] = p[0];
        old[o + 1] = p[1];
        old[o + 2] = p[2];
      }
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.alias[i] !== i) continue;
        const p = ps[i], v = vs[i];
        if (!im[i]) continue;
        v[1] -= 9.81 * this.gravityScale * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
        p[2] += v[2] * h;
      }
      k.prepare(h, this.elapsed);
      P.integrateAndGroupsMs += performance.now() - now;
      for (let iter = 0; iter < this.iterations; iter++) {
        now = performance.now();
        k.distances(0, this.count);
        P.distanceMs += performance.now() - now;
        if (this.strainGuard) {
          now = performance.now();
          k.strains();
          P.strainMs += performance.now() - now;
        }
        if (this.collisions) {
          now = performance.now();
          k.vertices(this.clearance);
          P.bodyVertexMs += performance.now() - now;
        }
      }
      now = performance.now();
      k.distances(baseCount, this.count);
      P.distanceMs += performance.now() - now;
      if (this.collisions && sub3 % 3 === 2) {
        now = performance.now();
        k.surfaces();
        P.bodySurfaceMs += performance.now() - now;
      }
      const extraStart=performance.now();for(let extra=0;extra<3;extra++){k.strains();k.vertices(this.clearance);}P.extraProjectionMs=(P.extraProjectionMs||0)+performance.now()-extraStart;
      this.bodyContacts += k.getContacts();
      now = performance.now();
      const damping = Math.exp(-20 * h);
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.alias[i] !== i) continue;
        const p = ps[i], v = vs[i], o = i * 3;
        v[0] = (p[0] - old[o]) / h * damping;
        v[1] = (p[1] - old[o + 1]) / h * damping;
        v[2] = (p[2] - old[o + 2]) / h * damping;
        if (p[1] < 0) {
          p[1] = 0;
          v[1] = 0;
        }
      }
      P.integrateAndGroupsMs += performance.now() - now;
    }
  }
  export() {
    const record = super.export();
    record.positionsMm = this.positions.map((p) => Array.from(p, (x) => x * 1e3));
    record.solver.execution = { backend: "R07-f64-algebraic-XPBD-plus-local-global", reducedIterations: true, reducedSubsteps: false, originalConstraintOrder: false, initialSubsteps:12, initialDistanceIterations:1, additionalStrainContactPasses:3, shortenedSewingStages:true, coupledRefinementIterations:1600, referenceEquivalent:false };
    return record;
  }
};

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/sdf-transport.mjs
async function decodeSDF(blob, meta) {
  if (!globalThis.DecompressionStream) throw Error("\u6B64\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u672C\u4F8B\u7684\u65E0\u635F\u8DDD\u79BB\u573A\u89E3\u538B");
  const bytes2 = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer(), delta = new Int16Array(bytes2);
  for (let i = 1; i < delta.length; i++) delta[i] = delta[i] + delta[i - 1] << 16 >> 16;
  if (bytes2.byteLength !== meta.transport.decodedBytes) throw Error("\u4EBA\u4F53\u8DDD\u79BB\u573A\u957F\u5EA6\u6821\u9A8C\u5931\u8D25");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes2))].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (hash !== meta.transport.decodedSha256) throw Error("\u4EBA\u4F53\u8DDD\u79BB\u573A\u5185\u5BB9\u6821\u9A8C\u5931\u8D25");
  return bytes2;
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/diagnostics.mjs
var dist = (q, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t);
};
var pathDist = (q, p, ids) => Math.min(...ids.slice(1).map((id, i) => dist(q, p.uvMm[ids[i]], p.uvMm[id])));
function regionalStrain(spec2, positionsMm) {
  const groups = Object.fromEntries(["ordinary_interior", "ordinary_seam_band", "free_edge_band", "planned_ease_band", "dart_band"].map((k) => [k, []])), perTriangle = [], all = [];
  let offset = 0;
  for (const p of spec2.panels) {
    const paths = { dart: [], ease: [], ordinary: [] }, used = /* @__PURE__ */ new Set();
    for (const s of spec2.seams) {
      for (const e of [s.a, s.b]) if (e.panelId === p.id) {
        const ids = p.edges[e.edge], len3 = ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0), kind = s.a.panelId === s.b.panelId ? "dart" : Math.abs(s.easeMm) / len3 >= 0.02 ? "ease" : "ordinary";
        paths[kind].push(ids);
        used.add(e.edge);
      }
    }
    const free = Object.entries(p.edges).filter(([key]) => !used.has(key)).map(([, ids]) => ids);
    for (let ti = 0; ti < p.triangles.length; ti++) {
      const ids = p.triangles[ti], [a, b, c] = ids.map((i) => p.uvMm[i]), [A, B, C] = ids.map((i) => positionsMm[offset + i]), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu, u = [0, 1, 2].map((k) => ((B[k] - A[k]) * ev - (C[k] - A[k]) * dv) / det), v = [0, 1, 2].map((k) => (-(B[k] - A[k]) * eu + (C[k] - A[k]) * du) / det), aa = u.reduce((n, x) => n + x * x, 0), bb = v.reduce((n, x) => n + x * x, 0), ab = u.reduce((n, x, k) => n + x * v[k], 0), dis = Math.hypot(aa - bb, 2 * ab), strain = Math.max(Math.abs(Math.sqrt(Math.max(0, (aa + bb + dis) / 2)) - 1), Math.abs(Math.sqrt(Math.max(0, (aa + bb - dis) / 2)) - 1)), centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3], near = (kind) => paths[kind].some((ids2) => pathDist(centroid, p, ids2) <= 16), region = near("dart") ? "dart_band" : near("ease") ? "planned_ease_band" : near("ordinary") ? "ordinary_seam_band" : free.some((ids2) => pathDist(centroid, p, ids2) <= 16) ? "free_edge_band" : "ordinary_interior";
      const row = { area: Math.abs(det) / 2, strain, panelId: p.id, triangle: ti, uvCentroidMm: centroid };
      groups[region].push(row);
      all.push(row);
      perTriangle.push(strain);
    }
    offset += p.uvMm.length;
  }
  const summarize = (rows) => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.strain - b.strain), area = rows.reduce((n2, r) => n2 + r.area, 0);
    let n = 0, p95 = 0;
    for (const r of sorted) {
      n += r.area;
      if (n >= area * 0.95) {
        p95 = r.strain;
        break;
      }
    }
    return { triangleCount: rows.length, areaMm2: area, maximumPercent: sorted.at(-1).strain * 100, p95AreaWeightedPercent: p95 * 100, areaOver5Percent: rows.filter((r) => r.strain > 0.05).reduce((n2, r) => n2 + r.area, 0) / area * 100, worst: sorted.slice(-8).reverse() };
  };
  return { metric: "original 2D UV principal stretch/compression; area weighted", thresholdMeaning: "5% diagnostic threshold, not official acceptance requirement", regionWidthMm: 16, allowanceModeled: false, all: summarize(all), ordinaryMaterial: summarize([...groups.ordinary_interior, ...groups.ordinary_seam_band, ...groups.free_edge_band]), regions: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)])), perTriangle };
}
function topology(spec2) {
  const offsets = /* @__PURE__ */ new Map();
  let n = 0;
  for (const p of spec2.panels) {
    offsets.set(p.id, n);
    n += p.uvMm.length;
  }
  const parent = Array.from({ length: n }, (_, i) => i), find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
  for (const s of spec2.seams) {
    const get = (e) => {
      const p = spec2.panels.find((p2) => p2.id === e.panelId), ids = p.edges[e.edge].map((i) => i + offsets.get(p.id));
      return e.reverse ? ids.reverse() : ids;
    }, a = get(s.a), b = get(s.b);
    a.forEach((id, i) => parent[find(id)] = find(b[i]));
  }
  const edges = /* @__PURE__ */ new Map(), tris = [];
  for (const p of spec2.panels) for (const t of p.triangles) {
    const ids = t.map((i) => find(offsets.get(p.id) + i));
    tris.push(ids);
    for (let i = 0; i < 3; i++) {
      const key = [ids[i], ids[(i + 1) % 3]].sort((a, b) => a - b).join(":");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [...edges].filter(([, n2]) => n2 === 1), adj = /* @__PURE__ */ new Map();
  for (const [k] of boundary) {
    const [a, b] = k.split(":").map(Number);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!adj.has(x)) adj.set(x, []);
      adj.get(x).push(y);
    }
  }
  let loops = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const start of adj.keys()) if (!seen.has(start)) {
    loops++;
    const todo = [start];
    while (todo.length) {
      const x = todo.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      todo.push(...adj.get(x));
    }
  }
  return { quotientOnly: true, boundaryLoops: loops, eulerCharacteristic: new Set(parent.map((_, i) => find(i))).size - edges.size + tris.length, nonManifoldEdges: [...edges.values()].filter((x) => x > 2).length, degenerateTriangles: tris.filter((x) => new Set(x).size < 3).length };
}

// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/intersection-audit.mjs
var sub2 = (a, b) => a.map((v, k) => v - b[k]);
var dot2 = (a, b) => a.reduce((n, v, k) => n + v * b[k], 0);
var cross4 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function segmentTriangle(a, b, x, y, z) {
  const d = sub2(b, a), e1 = sub2(y, x), e2 = sub2(z, x), p = cross4(d, e2), det = dot2(e1, p);
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det, t = sub2(a, x), u = dot2(t, p) * inv;
  if (u < -1e-8 || u > 1 + 1e-8) return false;
  const q = cross4(t, e1), v = dot2(d, q) * inv;
  if (v < -1e-8 || u + v > 1 + 1e-8) return false;
  const at = dot2(e2, q) * inv;
  return at > 1e-7 && at < 1 - 1e-7;
}
function intersects(a, b) {
  for (let i = 0; i < 3; i++) if (segmentTriangle(a[i], a[(i + 1) % 3], ...b) || segmentTriangle(b[i], b[(i + 1) % 3], ...a)) return true;
  return false;
}
var overlaps = (a, b) => !a.lo.some((x, k) => x > b.hi[k] || a.hi[k] < b.lo[k]);
var bounds = (points) => ({ lo: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))), hi: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))) });
function mesh(positions, faces) {
  const triangles = faces.map((ids, id) => {
    const points = ids.map((i) => positions[i]);
    return { id, ids, points, ...bounds(points) };
  });
  function build(rows) {
    const lo = [0, 1, 2].map((k) => Math.min(...rows.map((r) => r.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...rows.map((r) => r.hi[k])));
    if (rows.length <= 8) return { lo, hi, rows };
    const axis = [0, 1, 2].sort((a, b) => hi[b] - lo[b] - (hi[a] - lo[a]))[0];
    rows.sort((a, b) => a.lo[axis] + a.hi[axis] - b.lo[axis] - b.hi[axis]);
    const mid = rows.length >> 1;
    return { lo, hi, left: build(rows.slice(0, mid)), right: build(rows.slice(mid)) };
  }
  return { triangles, root: build([...triangles]) };
}
function candidates(node, box, out) {
  if (!overlaps(node, box)) return;
  if (node.rows) {
    for (const row of node.rows) if (overlaps(row, box)) out.push(row);
  } else {
    candidates(node.left, box, out);
    candidates(node.right, box, out);
  }
}
function prepareBodyAudit(body2) {
  return mesh(body2.positionsMm, body2.triangles);
}
function strictIntersectionAudit(spec2, positionsMm, groups, bodyMesh) {
  let offset = 0;
  const faces = spec2.panels.flatMap((p) => {
    const f = p.triangles.map((t) => t.map((i) => i + offset));
    offset += p.uvMm.length;
    return f;
  }), cloth = mesh(positionsMm, faces), bodyFaces = [], selfPairs = [];
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(bodyMesh.root, t, rows);
    if (rows.some((b) => intersects(t.points, b.points))) bodyFaces.push(t.id);
  }
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(cloth.root, t, rows);
    for (const b of rows) {
      if (b.id <= t.id) continue;
      if (intersects(t.points, b.points)||coplanarPositiveOverlap(t.points,b.points)) selfPairs.push([t.id, b.id]);
    }
  }
  return { bodyIntersectingFaceCount: bodyFaces.length, bodyIntersectingFaces: bodyFaces, selfStrictTriangleIntersectionCount: selfPairs.length, selfPairs, coplanarOverlapChecked: true, continuousCollisionChecked: false, stitchedAdjacencyMapUsed: false, sharedPointPairExclusions:false, method: "independent final BVH + proper segment/triangle and positive-area coplanar overlap; no shared-point blanket exclusions" };
}

// garment-catalogue-assembly-20261007/src/analytic-mesher.mjs
var import_cdt2d3 = __toESM(require_cdt2d(), 1);
var clone3 = (x) => JSON.parse(JSON.stringify(x));
var distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
var edgeKey = (p, e) => `${p}:${e}`;
var segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
var inside3 = (q, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
};
function curvePoint(panel, edge, t) {
  const [a, b] = edge.endpoints.map((i) => panel.verticesMm[i]);
  if (t === 0) return [...a];
  if (t === 1) return [...b];
  if (edge.kind === "line") return a.map((v, k) => v * (1 - t) + b[k] * t);
  if (edge.kind === "circle") {
    const q = edge.arc, angle = (q.startAngleDegrees + q.sweepDegrees * t) * Math.PI / 180;
    return [q.centerMm[0] + q.radiusMm * Math.cos(angle), q.centerMm[1] + q.radiusMm * Math.sin(angle)];
  }
  const pts = [a, ...edge.controlPointsMm, b].map((p) => [...p]);
  for (let count = pts.length - 1; count > 0; count--) for (let i = 0; i < count; i++) for (let k = 0; k < 2; k++) pts[i][k] = pts[i][k] * (1 - t) + pts[i + 1][k] * t;
  return pts[0];
}
function curveTable(panel, edge) {
  const n = edge.kind === "line" ? 1 : Math.max(32, Math.ceil(edge.lengthMm / 0.4)), points = [], lengths = [0];
  for (let i = 0; i <= n; i++) {
    points.push(curvePoint(panel, edge, i / n));
    if (i) lengths.push(lengths.at(-1) + distance3(points[i - 1], points[i]));
  }
  const total = lengths.at(-1);
  function at(f) {
    if (f === 0 || f === 1) return curvePoint(panel, edge, f);
    const target = f * total;
    let lo = 0, hi = n;
    while (hi - lo > 1) {
      const m = lo + hi >> 1;
      if (lengths[m] < target) lo = m;
      else hi = m;
    }
    const t = (lo + (target - lengths[lo]) / (lengths[hi] - lengths[lo])) / n;
    return curvePoint(panel, edge, t);
  }
  function error(count) {
    let maximum = 0;
    for (let i = 0; i <= n; i++) {
      const fraction = lengths[i] / total, j = Math.min(count - 1, Math.floor(fraction * count));
      maximum = Math.max(maximum, segmentDistance(points[i], at(j / count), at((j + 1) / count)));
    }
    return maximum;
  }
  return { at, error, total, denseSegments: n };
}
function worldPoint(panel, point) {
  const b = panel.placement.matrix3, t = panel.placement.translationMm;
  return b.map((row, i) => row[0] * point[0] + row[1] * point[1] + t[i]);
}
function classifyStage(seam, panels) {
  const a = seam.a.panelId, b = seam.b.panelId;
  if (seam.isDart || a === b) return "darts";
  if (/wb_|waistband/.test(a + " " + b)) return "waist";
  if (a.includes("pant") && b.includes("pant")) return a.includes("_f_") && b.includes("_f_") || a.includes("_b_") && b.includes("_b_") ? "rises" : "legs";
  if (a.includes("sleeve") && b.includes("sleeve")) return "sleeve_tubes";
  if (a.includes("sleeve") || b.includes("sleeve")) return "armholes";
  if (a.includes("torso") && b.includes("torso")) {
    if (a.includes("ftorso") && b.includes("ftorso") || a.includes("btorso") && b.includes("btorso")) return "centers";
    const pa = panels.get(a), pb = panels.get(b), ea = pa.edges[seam.a.edge], eb = pb.edges[seam.b.edge], ends = [...ea.endpoints.map((i) => worldPoint(pa, pa.verticesMm[i])), ...eb.endpoints.map((i) => worldPoint(pb, pb.verticesMm[i]))], span = Math.max(...ends.map((p) => p[1])) - Math.min(...ends.map((p) => p[1]));
    return span < Math.min(seam.lengthAMm, seam.lengthBMm) * 0.8 ? "shoulders" : "sides";
  }
  return "shell";
}
function compileAnalytic(input, { interiorStepMm = 16, boundaryStepMm = 16, chordToleranceMm = 0.25, measurementSnapshot, allowUnsupportedSeams = false, numericalStitchSpacingMm = null } = {}) {
  if (input.schema !== "kaopu-analytic-sewing-pattern@1" || input.units !== "mm") throw Error("Expected millimetre analytic sewing pattern");
  if (input.validation?.analytic2DPass !== true) throw Error("Source 2D validity failed; refusing material generation");
  if (![interiorStepMm, boundaryStepMm, chordToleranceMm].every((x) => Number.isFinite(x) && x > 0)) throw Error("Positive mesh controls required");
  if (numericalStitchSpacingMm !== null && (!Number.isFinite(numericalStitchSpacingMm) || numericalStitchSpacingMm <= 0)) throw Error("Positive numerical stitch spacing required");
  const sourcePanels = new Map(input.panels.map((p) => [p.id, p])), tables = /* @__PURE__ */ new Map(), counts = /* @__PURE__ */ new Map(), needleIntervals = /* @__PURE__ */ new Map(), edgeDiagnostics = [];
  for (const p of input.panels) for (const e of p.edges) {
    const key = edgeKey(p.id, e.index), table = curveTable(p, e);
    tables.set(key, table);
    let count = Math.max(1, Math.ceil(table.total / boundaryStepMm));
    while (table.error(count) > chordToleranceMm) {
      count *= 2;
      if (count > 4096) throw Error("Curve sampling budget exceeded");
    }
    counts.set(key, count);
  }
  for (const s of input.seams) {
    const ka = edgeKey(s.a.panelId, s.a.edge), kb = edgeKey(s.b.panelId, s.b.edge);
    let count = Math.max(counts.get(ka), counts.get(kb));
    if (numericalStitchSpacingMm !== null && requiresGatheredStitchSites(s)) {
      const intervals=Math.max(1,Math.ceil(Math.min(s.lengthAMm,s.lengthBMm)/numericalStitchSpacingMm));
      const subA=Math.max(s.lengthAMm>s.lengthBMm?3:1,Math.ceil(counts.get(ka)/intervals));
      const subB=Math.max(s.lengthBMm>s.lengthAMm?3:1,Math.ceil(counts.get(kb)/intervals));
      counts.set(ka,intervals*subA);counts.set(kb,intervals*subB);
      needleIntervals.set(s.id,{intervals,subdivisions:Math.max(subA,subB),subA,subB});continue;
    }
    counts.set(ka, count);
    counts.set(kb, count);
  }
  const panels = input.panels.map((p) => {
    const uvMm = clone3(p.verticesMm), boundary = [], edges = {}, edgeNotches = {};
    for (const e of p.edges) {
      const key = edgeKey(p.id, e.index), table = tables.get(key), count = counts.get(key), ids = [e.endpoints[0]];
      for (let i = 1; i < count; i++) {
        ids.push(uvMm.length);
        uvMm.push(table.at(i / count));
      }
      ids.push(e.endpoints[1]);
      edges[e.id] = ids;
      boundary.push(...ids.slice(0, -1));
      edgeNotches[e.id] = [];
      const polylineLengthMm = ids.slice(1).reduce((n, id, i) => n + distance3(uvMm[ids[i]], uvMm[id]), 0);
      edgeDiagnostics.push({ panelId: p.id, edge: e.id, kind: e.kind, segments: count, analyticLengthMm: e.lengthMm, denseLengthMm: table.total, polylineLengthMm, chordDeviationMm: table.error(count) });
    }
    const constraints = boundary.map((i, j) => [i, boundary[(j + 1) % boundary.length]]), poly = boundary.map((i) => uvMm[i]), xs = poly.map((p2) => p2[0]), ys = poly.map((p2) => p2[1]), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), boundaryCount = uvMm.length;
    let row = 0;
    for (let y = ymin + interiorStepMm * Math.sqrt(3) / 4; y < ymax; y += interiorStepMm * Math.sqrt(3) / 2, row++) for (let x = xmin + interiorStepMm / 2 + row % 2 * interiorStepMm / 2; x < xmax; x += interiorStepMm) {
      const q = [x, y];
      if (inside3(q, poly) && constraints.every(([a, b]) => segmentDistance(q, uvMm[a], uvMm[b]) > interiorStepMm * 0.42)) uvMm.push(q);
    }
    const triangles = (0, import_cdt2d3.default)(uvMm, constraints, { exterior: false }).map((t) => {
      const [a, b, c] = t.map((i) => uvMm[i]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0 ? t : [t[0], t[2], t[1]];
    });
    return { id: p.id, source: { kind: "official-GarmentCode-live-analytic-paper", version: input.source.commit, commit: input.source.commit, license: input.source.license, originalPanelId: p.id, bodySide: /back|btorso|_b_/.test(p.id) ? "back" : "front", originalPlacement: clone3(p.placement), meshMethod: "cdt2d@1.0.0; analytic curve arc-length samples" }, materialId: "digital-muslin", uvMm, triangles, boundary, edges, edgeNotches, grain: [0, 1], grainMeaning: "adapter convention local +Y; upstream supplied no grain field", seamAllowanceMm: 0, allowanceState: "meshed_flat_unfolded", placement: { translationMm: [...p.placement.translationMm], rigidBasis: p.placement.matrix3.flat(), rotationYDeg: 0 }, temporaryPins: [], temporaryPinTargetsMm: {}, temporaryGuideMaterialIds: Array.from({ length: uvMm.length - boundaryCount }, (_, i) => boundaryCount + i), meshType: "unstructured", analyticCurvesMm: clone3(p.edges), originalVertexCount: p.verticesMm.length };
  });
  const byId = new Map(panels.map((p) => [p.id, p])), unsupportedSeams = [];
  const seams = input.seams.map((s) => {
    const a = { ...s.a, edge: "e" + s.a.edge }, b = { ...s.b, edge: "e" + s.b.edge }, pa = byId.get(a.panelId), pb = byId.get(b.panelId), length = (p, e) => p.edges[e].slice(1).reduce((n, id, i) => n + distance3(p.uvMm[p.edges[e][i]], p.uvMm[id]), 0), la = length(pa, a.edge), lb = length(pb, b.edge), notches = [`${s.id}:start`, `${s.id}:end`];
    for (const [p, e] of [[pa, a], [pb, b]]) p.edgeNotches[e.edge] = notches.map((id, i) => ({ id, t: e.reverse ? 1 - i : i, meaning: "algorithmic stitch endpoint, not an upstream tailoring notch" }));
    if (Math.abs(lb - la) / la > 0.15 + 1e-9) unsupportedSeams.push({ id: s.id, ratioBOverA: lb / la, gathering: clone3(s.gathering), reason: "Original ideal dense stitch model is limited to 15%; sparse gathering stitches required" });
    const needle = needleIntervals.get(s.id), oriented = (p, e) => e.reverse ? [...p.edges[e.edge]].reverse() : p.edges[e.edge], aa = oriented(pa, a), bb = oriented(pb, b), samples = needle ? Array.from({ length: needle.intervals + 1 }, (_, i) => i * needle.subdivisions) : aa.map((_, i) => i), stitchVertexPairs = needle ? Array.from({length:needle.intervals+1},(_,i)=>[aa[i*needle.subA],bb[i*needle.subB]]) : samples.map((i) => [aa[i], bb[i]]);
    return { id: s.id, a, b, easeMm: lb - la, notches, stageId: classifyStage(s, sourcePanels), sourceStitchIndex: s.sourceStitchIndex, sourceSeam: clone3(s), seamModel: needle ? "separate sparse numerical stitch samples; intervening material remains free" : "ideal zero-width equality after progressive closure", stitchVertexPairs, numericalStitchPlan: needle ? { ...needle, targetSpacingMm: numericalStitchSpacingMm, physicalSewingNeedleSpacing: false, restMaterialRescaled: false, fullMaterialEdgeSampleCount: aa.length, materialEdgeSampleCountA:aa.length,materialEdgeSampleCountB:bb.length, intermediateMaterialVerticesPerIntervalA:needle.subA-1,intermediateMaterialVerticesPerIntervalB:needle.subB-1 } : null, analyticEaseDefinition: "upstream A-B; current solver stores sampled B-A; original preserved in sourceSeam" };
  });
  const order = ["darts", "centers", "rises", "legs", "sleeve_tubes", "shoulders", "armholes", "sides", "shell", "waist"], activeOrder = order.filter((id) => seams.some((s) => s.stageId === id));
  const stages2 = [{ id: "cut", requires: [], seams: [] }, ...activeOrder.map((id, i) => ({ id, requires: [i ? activeOrder[i - 1] : "cut"], seams: seams.filter((s) => s.stageId === id).map((s) => s.id) }))];
  const spec2 = { schema: "kaopu-sewing-graph@1", id: `catalogue-${input.geometryHash}`, revision: 1, units: "mm", purpose: "live_official_pattern_to_original_cloth_solver", source: { kind: "GarmentCode MIT live analytic pattern", experimentalSparseSewing: numericalStitchSpacingMm !== null, commit: input.source.commit, recipeHash: input.recipeHash, geometryHash: input.geometryHash, bodyMeasurements: clone3(input.bodyCm), measurementSnapshot: clone3(measurementSnapshot || {}), bodyId: measurementSnapshot?.bodyId || "not-selected", options: {}, assemblyExperiment: activeOrder, officialPanelCount: panels.length, officialStitchCount: seams.length, meshing: { method: "cdt2d@1.0.0", interiorSpacingMm: interiorStepMm, boundaryMaximumNominalStepMm: boundaryStepMm, chordToleranceMm, restMetric: "original analytic paper coordinates; no seam-length normalization", edgeDiagnostics }, generationSource: clone3(input.source), analyticInputValidation: clone3(input.validation) }, materials: [{ id: "digital-muslin", densityKgM2: 0.2, stretchCompliance: 1e-7, bendCompliance: 20, calibrated: false }], panels, seams, stages: stages2, acceptance: { productionReady: false, fitValidated: false }, adapterDiagnostics: { unsupportedSeams, solverCompatible: unsupportedSeams.length === 0 } };
  if (unsupportedSeams.length) validate2({ ...spec2, seams: [], stages: [{ id: "cut", requires: [], seams: [] }] });
  if (unsupportedSeams.length && !allowUnsupportedSeams) {
    const error = new Error(`GATHERING_MODEL_REQUIRED: ${unsupportedSeams.map((s) => s.id).join(", ")}`);
    error.diagnosticSpec = spec2;
    throw error;
  }
  if (!unsupportedSeams.length) validate2(spec2);
  return spec2;
}

// garment-catalogue-assembly-20261007/src/workbench-worker.mjs
var root;
var patternBase;
var engine;
var config;
var spec;
var analytic;
var lab;
var sdf;
var bodyAudit;
var body;
var requestId = 0;
var epoch = 0;
var running = false;
var stageIndex = 0;
var stageFrame = 0;
var stages = [];
var totalFrames = 0;
var runStarted = 0;
var wallMs = 0;
var lastPacket = 0;
var kernelReady = false;
var pendingPause = false;
var refinementSteps=0,layerGuide=null,jointSteps=0,jointInfo=null,closureInfo=null;
var cachedBodyURL;
var cachedSDFURL;
var profile = { pythonMs: 0, meshMs: 0, bodyMs: 0, solveMs: 0, auditMs: 0, packetMs: 0 };
var emit = (type, data = {}, transfer = []) => postMessage({ requestId, ...data, type }, transfer);
var url = (p) => new URL(p, root).href;
async function json(path) {
  const r = await fetch(url(path));
  if (!r.ok) throw Error(`HTTP ${r.status}: ${path}`);
  return r.json();
}
async function bytes(path) {
  const r = await fetch(url(path));
  if (!r.ok) throw Error(`HTTP ${r.status}: ${path}`);
  return r.arrayBuffer();
}
function stop() {
  if (running) wallMs += performance.now() - runStarted;
  running = false;
  epoch++;
}
function initialPositions(paper) {
  const flat = new Float32Array(paper.panels.reduce((n, p) => n + p.uvMm.length * 3, 0));
  let i = 0;
  for (const p of paper.panels) {
    const b = p.placement.rigidBasis, t = p.placement.translationMm;
    for (const [u, v] of p.uvMm) {
      flat[i++] = (b[0] * u + b[1] * v + t[0]) / 1e3;
      flat[i++] = (b[3] * u + b[4] * v + t[1]) / 1e3;
      flat[i++] = (b[6] * u + b[7] * v + t[2]) / 1e3;
    }
  }
  return flat;
}
async function material(data, token) {
  if (data.kind === "legacy") {
    const programs = { shorts: paper_program_exports, sleeveless: paper_program_exports2, shortsleeve: paper_program_exports3 }, program = programs[data.caseId];
    if (!program) throw Error("Unknown accepted garment");
    const base = await json(data.directory + "/assets/teacher-paper-base.json");
    if (token !== epoch) return;
    const start2 = performance.now(), graded = program.gradePaper(base, data.controls), paper2 = program.meshPaper ? program.meshPaper(graded) : graded;
    profile.meshMs = performance.now() - start2;
    return { paper: paper2, sourcePattern: null };
  }
  if (!engine) {
    const imported = await import(new URL("pattern-engine.mjs", patternBase).href);
    engine = imported.createPatternEngine();
  }
  const start = performance.now(), sourcePattern = await engine.generate(data.recipe, { assetBase: patternBase }, (progress) => {
    if (token === epoch) emit("runtime", progress);
  });
  profile.pythonMs = performance.now() - start;
  if (token !== epoch) return;
  const meshStart = performance.now(), paper = compileAnalytic(sourcePattern, { allowUnsupportedSeams: true, numericalStitchSpacingMm: 12, measurementSnapshot: {bodyId:"anny-adult-neutral-r01"} });
  paper.source.bodyId="anny-adult-neutral-r01";
  paper.source.trialBoundary="Original paper, original body, sparse numerical stitching; not calibrated cloth or fit certification. No continuous collision or runtime self-contact response.";
  validate2(paper);
  profile.meshMs = performance.now() - meshStart;
  return { paper, sourcePattern };
}
function packet(type, extra = {}) {
  const start = performance.now(), positionsM = new Float32Array(lab.positions.length * 3);
  for (let i = 0; i < lab.positions.length; i++) positionsM.set(lab.positions[i], i * 3);
  profile.packetMs += performance.now() - start;
  emit(type, { positionsM, metrics: lab.metrics(), frame: lab.frameCount, stage: stages[stageIndex] || "complete", progress: (lab.frameCount+refinementSteps+jointSteps) / totalFrames, activeWallMs: wallMs + (running ? performance.now() - runStarted : 0), profile: { ...profile }, ...extra }, [positionsM.buffer]);
}
async function startLegacySolve(token) {
 const sizing=preflightSizing(analytic);if(sizing.blocking)throw Error(sizing.message);
  if (config.kind !== "legacy" && !spec.source.experimentalSparseSewing) throw Error("Generate the R06 sparse-stitch material before a new-style trial");
  const directory=config.kind === "legacy"?config.directory:"r06";
  const start = performance.now(), bodyPath = "garments-r04/assets/body-anny-adult.json", metaPath = directory + "/assets/body-sdf-grid.json";
  if (cachedBodyURL !== bodyPath) {
    body = await json(bodyPath);
    if (token !== epoch) return;
    bodyAudit = prepareBodyAudit(body);
    cachedBodyURL = bodyPath;
  }
  if (cachedSDFURL !== metaPath) {
    const meta = await json(metaPath), raw = await bytes(directory + "/assets/" + meta.transport.file), buffer = await decodeSDF(new Blob([raw]), meta);
    if (token !== epoch) return;
    sdf = new BodySDF(meta, new Int16Array(buffer));
    cachedSDFURL = metaPath;
  }
  if (!kernelReady) {
    configureWasm(await bytes("r07/stability/joint-r072.wasm"));
    if (token !== epoch) return;
    kernelReady = true;
  }
  profile.bodyMs = performance.now() - start;
  if(config.kind==="legacy")throw Error("基础款须使用保留的 R06 原始计算线程");
  prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);
  lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 1, sewingDuration:.75 });
  lab.orientationGuides = false;
  lab.selfCollisionEnabled = false;
  lab.stitchEqualityElimination = true;
  lab.strainGuard = true;
  stages = [...spec.source.assemblyExperiment, "release", "refine", "joint"];
  totalFrames = spec.source.assemblyExperiment.length * 90 + 120 + 1600 + 1600;
  refinementSteps=0;layerGuide=null;jointSteps=0;jointInfo=closureInfo=null;
  stageIndex = stageFrame = wallMs = 0;
  if (pendingPause) { running=false; packet("paused"); return; }
  running = true;
  runStarted = performance.now();
  packet("started");
  tick(token);
}
function tick(token) {
  if (!running || token !== epoch) return;
  try {
    const start = performance.now();
    if(wallMs+start-runStarted>90000)throw Error("快速试算达到 90 秒计算预算，已中止；没有把未完成结果标为成衣。");
    let n = 0;
    do {
      if (stageFrame === 0) {
        if (stages[stageIndex] === "release") {
          lab.releasePins();
          lab.setGravity(1);
        } else if(stages[stageIndex]==="refine"){lab.kernel.prepare(1/720,lab.elapsed);layerGuide=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}
        else if(stages[stageIndex]==="joint"){jointInfo=beginJointRefinement(lab);}
        else {lab.activate(stages[stageIndex]);if(stages[stageIndex]==="sides")lab.releasePins();}
      }
      const time = performance.now();
      if(stages[stageIndex]==="refine"){
        lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();
        if(stageFrame>=400&&stageFrame<1400)layerGuide.project();
        refinementSteps++;
      }else if(stages[stageIndex]==="joint"){const code=lab.kernel.qnStep();if(code<0)throw Error("联合整理遇到无效状态，已停止并保留当前材料。");jointSteps++;}else lab.step();
      profile.solveMs += performance.now() - time;
      stageFrame++;
      n++;
      const frames = ["refine","joint"].includes(stages[stageIndex])?1600:stages[stageIndex]==="release"?120:90;
      if (stageFrame === frames) {
        if(stages[stageIndex]==="joint"){jointInfo=jointReport(lab,jointInfo);closureInfo=finalizeCloseSeams(lab);}
        const check=lab.metrics();if(!check.finite||check.maxPrincipalStrain>5)throw Error("当前参数出现严重变形，快速试算已中止，未生成合格成衣。请导出问题快照检查该工序。");
        packet("stage", { completedStage: stages[stageIndex] });
        stageIndex++;
        stageFrame = 0;
        if (stageIndex === stages.length) {
          wallMs += performance.now() - runStarted;
          running = false;
          packet("auditing");
          const begin = performance.now(), record = lab.export(), regions = regionalStrain(spec, record.positionsMm), intersections = strictIntersectionAudit(spec, record.positionsMm, record.materialToSolverGroup, bodyAudit);
          const gate=staticGate(lab,record,regions,intersections);record.staticGate=gate;
          profile.auditMs = performance.now() - begin;
          if(config.kind!=="legacy"){
            record.jointRefinement={...jointInfo,closure:closureInfo};
            record.trial={version:"R07.2",style:config.recipe.design.style,sourceRecipeHash:spec.source.recipeHash,physicalFitAccepted:false,solver:"shortened XPBD sewing and gravity settling, then 1600 global and 1600 joint objective refinement steps; declared close needle pairs finalized",referenceEquivalent:false,runtimeSelfContact:false,temporarySeamSideGuides:layerGuide?.count||0,guideFreeFinalSweeps:0,sourceLocalSeamInequalities:true,continuousCollision:false,materialCalibrated:false,seamAllowanceAndThickness:false,physicalFrameCount:lab.frameCount,refinementSteps,jointSteps};
          }
          emit("done", { record, regions, intersections, profile, activeWallMs: wallMs + profile.auditMs });
          return;
        }
      }
    } while (n < 8 && performance.now() - start < 22);
    if (performance.now() - lastPacket > 100) {
      packet("progress");
      lastPacket = performance.now();
    }
    setTimeout(() => tick(token), 0);
  } catch (e) {
    stop();
    emit("error", { message: e.message });
  }
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "boot") {
      root = data.root;
      patternBase = data.patternBase;
      emit("ready", { runtimeLoaded: false });
    } else if (data.type === "generate") {
      stop();
      requestId = data.requestId;
      config = data.config;
      spec = analytic = lab = null;
      for (const key in profile) profile[key] = 0;
      const token = epoch, result = await material(config, token);
      if (token !== epoch || !result) return;
      spec = result.paper;
      analytic = result.sourcePattern;
      const positionsM = initialPositions(spec);
      emit("paper", { spec, analytic, positionsM, fingerprint: fingerprint2(spec), topology: topology(spec), profile, fitPreflight:preflightSizing(analytic),canSew: !preflightSizing(analytic).blocking && (config.kind === "legacy" || spec.source.experimentalSparseSewing === true), physicalStatus: config.kind === "legacy" ? "accepted baseline family; current parameters require actual solve" : "R06 live sparse-stitch trial available; no fit certificate" }, [positionsM.buffer]);
    } else if (data.type === "run") {
      if (!spec) throw Error("Generate the current flat material first");
      if (data.requestId !== requestId) throw Error("Stale paper revision");
      stop();
      pendingPause=false;
      await startLegacySolve(epoch);
    } else if (data.type === "pause") {
      pendingPause=true;
      if (lab) { stop(); packet("paused"); }
    } else if (data.type === "resume") {
      pendingPause=false;
      if (!lab || running || stageIndex >= stages.length) throw Error("No paused solve to resume");
      running = true;
      runStarted = performance.now();
      tick(++epoch);
    } else if (data.type === "invalidate") {
      stop();
      requestId = data.requestId;
      spec = analytic = lab = null;
      emit("invalidated");
    } else if (data.type === "export") {
      emit("export", { spec, analytic, record: lab?.export() });
    } else if (data.type === "status") {
      emit("status", { runtimeLoaded: !!engine, runtimeStatus: engine?.status(), running, hasPaper: !!spec, workerOwnsPythonAndCloth: true });
    }
  } catch (e) {
    if (data.requestId !== void 0 && data.requestId !== requestId) return;
    stop();
    emit("error", { message: e.message, name: e.name, fatal: !!e.fatal, validation: e.validation, diagnosticPattern: e.diagnosticPattern });
  }
};
