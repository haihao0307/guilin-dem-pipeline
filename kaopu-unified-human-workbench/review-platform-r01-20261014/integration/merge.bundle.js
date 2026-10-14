(()=>{var Nr=1;var jn=0,Fr=1,_i=2,Me=0,je=1;var Vi=100;var Gi=204,qi=205;var Wi=0,Qi=1,Yi=2,Ze=3,Xi=4,Ki=5,ji=6,Zi=7,ws=0;var Ts=0;var Or=7;var zr=300,Ji=301,$i=302,Hr=303;var Ds=306,tr=1e3,yt=1001,er=1002,Je=1003;var bt=1006;var un=1008;var Bs=1009;var bi=1015,Ls=1016;var dn=1023;var $e=2300,Zn=2301,Un=2302,nr=2400,ir=2401,rr=2402;var Vr=3201;var Gr="",j="srgb",Pe="srgb-linear",qr="linear",Jn="srgb";var Jt=7680;var sr=519;var or=35044,fn=35048;var Wr="300 es",Gt=2e3,$n=2001,qt=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;let n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;let i=this._listeners[t];if(i!==void 0){let r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;let n=this._listeners[t.type];if(n!==void 0){t.target=this;let i=n.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,t);t.target=null}}},W=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var _n=Math.PI/180,ar=180/Math.PI;function Se(){let c=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(W[c&255]+W[c>>8&255]+W[c>>16&255]+W[c>>24&255]+"-"+W[t&255]+W[t>>8&255]+"-"+W[t>>16&15|64]+W[t>>24&255]+"-"+W[e&63|128]+W[e>>8&255]+"-"+W[e>>16&255]+W[e>>24&255]+W[n&255]+W[n>>8&255]+W[n>>16&255]+W[n>>24&255]).toLowerCase()}function Z(c,t,e){return Math.max(t,Math.min(e,c))}function ks(c,t){return(c%t+t)%t}function bn(c,t,e){return(1-e)*c+e*t}function xe(c,t){switch(t.constructor){case Float32Array:return c;case Uint32Array:return c/4294967295;case Uint16Array:return c/65535;case Uint8Array:return c/255;case Int32Array:return Math.max(c/2147483647,-1);case Int16Array:return Math.max(c/32767,-1);case Int8Array:return Math.max(c/127,-1);default:throw new Error("Invalid component type.")}}function K(c,t){switch(t.constructor){case Float32Array:return c;case Uint32Array:return Math.round(c*4294967295);case Uint16Array:return Math.round(c*65535);case Uint8Array:return Math.round(c*255);case Int32Array:return Math.round(c*2147483647);case Int16Array:return Math.round(c*32767);case Int8Array:return Math.round(c*127);default:throw new Error("Invalid component type.")}}var O=class c{constructor(t=0,e=0){c.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Z(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,s=this.y-t.y;return this.x=r*n-s*i+t.x,this.y=r*i+s*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},C=class c{constructor(t,e,n,i,r,s,o,a,l){c.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,s,o,a,l)}set(t,e,n,i,r,s,o,a,l){let h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=r,h[5]=a,h[6]=n,h[7]=s,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,i=e.elements,r=this.elements,s=n[0],o=n[3],a=n[6],l=n[1],h=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=i[0],v=i[3],g=i[6],_=i[1],A=i[4],y=i[7],U=i[2],P=i[5],E=i[8];return r[0]=s*m+o*_+a*U,r[3]=s*v+o*A+a*P,r[6]=s*g+o*y+a*E,r[1]=l*m+h*_+u*U,r[4]=l*v+h*A+u*P,r[7]=l*g+h*y+u*E,r[2]=d*m+f*_+p*U,r[5]=d*v+f*A+p*P,r[8]=d*g+f*y+p*E,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],s=t[4],o=t[5],a=t[6],l=t[7],h=t[8];return e*s*h-e*o*l-n*r*h+n*o*a+i*r*l-i*s*a}invert(){let t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],s=t[4],o=t[5],a=t[6],l=t[7],h=t[8],u=h*s-o*l,d=o*a-h*r,f=l*r-s*a,p=e*u+n*d+i*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return t[0]=u*m,t[1]=(i*l-h*n)*m,t[2]=(o*n-i*s)*m,t[3]=d*m,t[4]=(h*e-i*a)*m,t[5]=(i*r-o*e)*m,t[6]=f*m,t[7]=(n*a-l*e)*m,t[8]=(s*e-n*r)*m,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,s,o){let a=Math.cos(r),l=Math.sin(r);return this.set(n*a,n*l,-n*(a*s+l*o)+s+t,-i*l,i*a,-i*(-l*s+a*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(En.makeScale(t,e)),this}rotate(t){return this.premultiply(En.makeRotation(-t)),this}translate(t,e){return this.premultiply(En.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},En=new C;function Rs(c){for(let t=c.length-1;t>=0;--t)if(c[t]>=65535)return!0;return!1}function cr(c){return document.createElementNS("http://www.w3.org/1999/xhtml",c)}var ot={enabled:!0,workingColorSpace:Pe,spaces:{},convert:function(c,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===Jn&&(c.r=Ut(c.r),c.g=Ut(c.g),c.b=Ut(c.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(c.applyMatrix3(this.spaces[t].toXYZ),c.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===Jn&&(c.r=ue(c.r),c.g=ue(c.g),c.b=ue(c.b))),c},fromWorkingColorSpace:function(c,t){return this.convert(c,this.workingColorSpace,t)},toWorkingColorSpace:function(c,t){return this.convert(c,t,this.workingColorSpace)},getPrimaries:function(c){return this.spaces[c].primaries},getTransfer:function(c){return c===Gr?qr:this.spaces[c].transfer},getLuminanceCoefficients:function(c,t=this.workingColorSpace){return c.fromArray(this.spaces[t].luminanceCoefficients)},define:function(c){Object.assign(this.spaces,c)},_getMatrix:function(c,t,e){return c.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(c){return this.spaces[c].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(c=this.workingColorSpace){return this.spaces[c].workingColorSpaceConfig.unpackColorSpace}};function Ut(c){return c<.04045?c*.0773993808:Math.pow(c*.9478672986+.0521327014,2.4)}function ue(c){return c<.0031308?c*12.92:1.055*Math.pow(c,.41666)-.055}var lr=[.64,.33,.3,.6,.15,.06],hr=[.2126,.7152,.0722],ur=[.3127,.329],dr=new C().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),fr=new C().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);ot.define({[Pe]:{primaries:lr,whitePoint:ur,transfer:qr,toXYZ:dr,fromXYZ:fr,luminanceCoefficients:hr,workingColorSpaceConfig:{unpackColorSpace:j},outputColorSpaceConfig:{drawingBufferColorSpace:j}},[j]:{primaries:lr,whitePoint:ur,transfer:Jn,toXYZ:dr,fromXYZ:fr,luminanceCoefficients:hr,outputColorSpaceConfig:{drawingBufferColorSpace:j}}});var $t,ti=class{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{$t===void 0&&($t=cr("canvas")),$t.width=t.width,$t.height=t.height;let n=$t.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=$t}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=cr("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let s=0;s<r.length;s++)r[s]=Ut(r[s]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Ut(e[n]/255)*255):e[n]=Ut(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Is=0,tn=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Is++}),this.uuid=Se(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let s=0,o=i.length;s<o;s++)i[s].isDataTexture?r.push(Mn(i[s].image)):r.push(Mn(i[s]))}else r=Mn(i);n.url=r}return e||(t.images[this.uuid]=n),n}};function Mn(c){return typeof HTMLImageElement<"u"&&c instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&c instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&c instanceof ImageBitmap?ti.getDataURL(c):c.data?{data:Array.from(c.data),width:c.width,height:c.height,type:c.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Ns=0,Dt=class c extends qt{constructor(t=c.DEFAULT_IMAGE,e=c.DEFAULT_MAPPING,n=yt,i=yt,r=bt,s=un,o=dn,a=Bs,l=c.DEFAULT_ANISOTROPY,h=Gr){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Ns++}),this.uuid=Se(),this.name="",this.source=new tn(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=s,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=a,this.offset=new O(0,0),this.repeat=new O(1,1),this.center=new O(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new C,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==zr)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case tr:t.x=t.x-Math.floor(t.x);break;case yt:t.x=t.x<0?0:1;break;case er:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case tr:t.y=t.y-Math.floor(t.y);break;case yt:t.y=t.y<0?0:1;break;case er:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Dt.DEFAULT_IMAGE=null;Dt.DEFAULT_MAPPING=zr;Dt.DEFAULT_ANISOTROPY=1;var ft=class c{constructor(t=0,e=0,n=0,i=1){c.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,i=this.z,r=this.w,s=t.elements;return this.x=s[0]*e+s[4]*n+s[8]*i+s[12]*r,this.y=s[1]*e+s[5]*n+s[9]*i+s[13]*r,this.z=s[2]*e+s[6]*n+s[10]*i+s[14]*r,this.w=s[3]*e+s[7]*n+s[11]*i+s[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r,a=t.elements,l=a[0],h=a[4],u=a[8],d=a[1],f=a[5],p=a[9],m=a[2],v=a[6],g=a[10];if(Math.abs(h-d)<.01&&Math.abs(u-m)<.01&&Math.abs(p-v)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+m)<.1&&Math.abs(p+v)<.1&&Math.abs(l+f+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let A=(l+1)/2,y=(f+1)/2,U=(g+1)/2,P=(h+d)/4,E=(u+m)/4,M=(p+v)/4;return A>y&&A>U?A<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(A),i=P/n,r=E/n):y>U?y<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(y),n=P/i,r=M/i):U<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(U),n=E/r,i=M/r),this.set(n,i,r,e),this}let _=Math.sqrt((v-p)*(v-p)+(u-m)*(u-m)+(d-h)*(d-h));return Math.abs(_)<.001&&(_=1),this.x=(v-p)/_,this.y=(u-m)/_,this.z=(d-h)/_,this.w=Math.acos((l+f+g-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},ei=class extends qt{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ft(0,0,t,e),this.scissorTest=!1,this.viewport=new ft(0,0,t,e);let i={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:bt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);let r=new Dt(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];let s=n.count;for(let o=0;o<s;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=t,this.textures[i].image.height=e,this.textures[i].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;let e=Object.assign({},t.texture.image);return this.texture.source=new tn(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},be=class extends ei{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},en=class extends Dt{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Je,this.minFilter=Je,this.wrapR=yt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Bt=class{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,s,o){let a=n[i+0],l=n[i+1],h=n[i+2],u=n[i+3],d=r[s+0],f=r[s+1],p=r[s+2],m=r[s+3];if(o===0){t[e+0]=a,t[e+1]=l,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=f,t[e+2]=p,t[e+3]=m;return}if(u!==m||a!==d||l!==f||h!==p){let v=1-o,g=a*d+l*f+h*p+u*m,_=g>=0?1:-1,A=1-g*g;if(A>Number.EPSILON){let U=Math.sqrt(A),P=Math.atan2(U,g*_);v=Math.sin(v*P)/U,o=Math.sin(o*P)/U}let y=o*_;if(a=a*v+d*y,l=l*v+f*y,h=h*v+p*y,u=u*v+m*y,v===1-o){let U=1/Math.sqrt(a*a+l*l+h*h+u*u);a*=U,l*=U,h*=U,u*=U}}t[e]=a,t[e+1]=l,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,s){let o=n[i],a=n[i+1],l=n[i+2],h=n[i+3],u=r[s],d=r[s+1],f=r[s+2],p=r[s+3];return t[e]=o*p+h*u+a*f-l*d,t[e+1]=a*p+h*d+l*u-o*f,t[e+2]=l*p+h*f+o*d-a*u,t[e+3]=h*p-o*u-a*d-l*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,i=t._y,r=t._z,s=t._order,o=Math.cos,a=Math.sin,l=o(n/2),h=o(i/2),u=o(r/2),d=a(n/2),f=a(i/2),p=a(r/2);switch(s){case"XYZ":this._x=d*h*u+l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u-d*f*p;break;case"YXZ":this._x=d*h*u+l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u+d*f*p;break;case"ZXY":this._x=d*h*u-l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u-d*f*p;break;case"ZYX":this._x=d*h*u-l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u+d*f*p;break;case"YZX":this._x=d*h*u+l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u-d*f*p;break;case"XZY":this._x=d*h*u-l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u+d*f*p;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+s)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],i=e[4],r=e[8],s=e[1],o=e[5],a=e[9],l=e[2],h=e[6],u=e[10],d=n+o+u;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-a)*f,this._y=(r-l)*f,this._z=(s-i)*f}else if(n>o&&n>u){let f=2*Math.sqrt(1+n-o-u);this._w=(h-a)/f,this._x=.25*f,this._y=(i+s)/f,this._z=(r+l)/f}else if(o>u){let f=2*Math.sqrt(1+o-n-u);this._w=(r-l)/f,this._x=(i+s)/f,this._y=.25*f,this._z=(a+h)/f}else{let f=2*Math.sqrt(1+u-n-o);this._w=(s-i)/f,this._x=(r+l)/f,this._y=(a+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Z(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,i=t._y,r=t._z,s=t._w,o=e._x,a=e._y,l=e._z,h=e._w;return this._x=n*h+s*o+i*l-r*a,this._y=i*h+s*a+r*o-n*l,this._z=r*h+s*l+n*a-i*o,this._w=s*h-n*o-i*a-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);let n=this._x,i=this._y,r=this._z,s=this._w,o=s*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=s,this._x=n,this._y=i,this._z=r,this;let a=1-o*o;if(a<=Number.EPSILON){let f=1-e;return this._w=f*s+e*this._w,this._x=f*n+e*this._x,this._y=f*i+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}let l=Math.sqrt(a),h=Math.atan2(l,o),u=Math.sin((1-e)*h)/l,d=Math.sin(e*h)/l;return this._w=s*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},x=class c{constructor(t=0,e=0,n=0){c.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(pr.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(pr.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,i=this.z,r=t.elements,s=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*s,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*s,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*s,this}applyQuaternion(t){let e=this.x,n=this.y,i=this.z,r=t.x,s=t.y,o=t.z,a=t.w,l=2*(s*i-o*n),h=2*(o*e-r*i),u=2*(r*n-s*e);return this.x=e+a*l+s*u-o*h,this.y=n+a*h+o*l-r*u,this.z=i+a*u+r*h-s*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,i=t.y,r=t.z,s=e.x,o=e.y,a=e.z;return this.x=i*a-r*o,this.y=r*s-n*a,this.z=n*o-i*s,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Pn.copy(this).projectOnVector(t),this.sub(Pn)}reflect(t){return this.sub(Pn.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Z(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Pn=new x,pr=new Bt,Wt=class{constructor(t=new x(1/0,1/0,1/0),e=new x(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(at.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(at.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=at.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let s=0,o=r.count;s<o;s++)t.isMesh===!0?t.getVertexPosition(s,at):at.fromBufferAttribute(r,s),at.applyMatrix4(t.matrixWorld),this.expandByPoint(at);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),De.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),De.copy(n.boundingBox)),De.applyMatrix4(t.matrixWorld),this.union(De)}let i=t.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,at),at.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ae),Be.subVectors(this.max,Ae),te.subVectors(t.a,Ae),ee.subVectors(t.b,Ae),ne.subVectors(t.c,Ae),Et.subVectors(ee,te),Mt.subVectors(ne,ee),It.subVectors(te,ne);let e=[0,-Et.z,Et.y,0,-Mt.z,Mt.y,0,-It.z,It.y,Et.z,0,-Et.x,Mt.z,0,-Mt.x,It.z,0,-It.x,-Et.y,Et.x,0,-Mt.y,Mt.x,0,-It.y,It.x,0];return!Sn(e,te,ee,ne,Be)||(e=[1,0,0,0,1,0,0,0,1],!Sn(e,te,ee,ne,Be))?!1:(Le.crossVectors(Et,Mt),e=[Le.x,Le.y,Le.z],Sn(e,te,ee,ne,Be))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,at).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(at).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(mt[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),mt[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),mt[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),mt[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),mt[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),mt[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),mt[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),mt[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(mt),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}},mt=[new x,new x,new x,new x,new x,new x,new x,new x],at=new x,De=new Wt,te=new x,ee=new x,ne=new x,Et=new x,Mt=new x,It=new x,Ae=new x,Be=new x,Le=new x,Nt=new x;function Sn(c,t,e,n,i){for(let r=0,s=c.length-3;r<=s;r+=3){Nt.fromArray(c,r);let o=i.x*Math.abs(Nt.x)+i.y*Math.abs(Nt.y)+i.z*Math.abs(Nt.z),a=t.dot(Nt),l=e.dot(Nt),h=n.dot(Nt);if(Math.max(-Math.max(a,l,h),Math.min(a,l,h))>o)return!1}return!0}var Fs=new Wt,ye=new x,Cn=new x,Ee=class{constructor(t=new x,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Fs.setFromPoints(t).getCenter(n);let i=0;for(let r=0,s=t.length;r<s;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;ye.subVectors(t,this.center);let e=ye.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(ye,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Cn.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(ye.copy(t.center).add(Cn)),this.expandByPoint(ye.copy(t.center).sub(Cn))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}},vt=new x,wn=new x,ke=new x,Pt=new x,Tn=new x,Re=new x,Dn=new x,ni=class{constructor(t=new x,e=new x(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,vt)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=vt.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(vt.copy(this.origin).addScaledVector(this.direction,e),vt.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){wn.copy(t).add(e).multiplyScalar(.5),ke.copy(e).sub(t).normalize(),Pt.copy(this.origin).sub(wn);let r=t.distanceTo(e)*.5,s=-this.direction.dot(ke),o=Pt.dot(this.direction),a=-Pt.dot(ke),l=Pt.lengthSq(),h=Math.abs(1-s*s),u,d,f,p;if(h>0)if(u=s*a-o,d=s*o-a,p=r*h,u>=0)if(d>=-p)if(d<=p){let m=1/h;u*=m,d*=m,f=u*(u+s*d+2*o)+d*(s*u+d+2*a)+l}else d=r,u=Math.max(0,-(s*d+o)),f=-u*u+d*(d+2*a)+l;else d=-r,u=Math.max(0,-(s*d+o)),f=-u*u+d*(d+2*a)+l;else d<=-p?(u=Math.max(0,-(-s*r+o)),d=u>0?-r:Math.min(Math.max(-r,-a),r),f=-u*u+d*(d+2*a)+l):d<=p?(u=0,d=Math.min(Math.max(-r,-a),r),f=d*(d+2*a)+l):(u=Math.max(0,-(s*r+o)),d=u>0?r:Math.min(Math.max(-r,-a),r),f=-u*u+d*(d+2*a)+l);else d=s>0?-r:r,u=Math.max(0,-(s*d+o)),f=-u*u+d*(d+2*a)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(wn).addScaledVector(ke,d),f}intersectSphere(t,e){vt.subVectors(t.center,this.origin);let n=vt.dot(this.direction),i=vt.dot(vt)-n*n,r=t.radius*t.radius;if(i>r)return null;let s=Math.sqrt(r-i),o=n-s,a=n+s;return a<0?null:o<0?this.at(a,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,s,o,a,l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(t.min.x-d.x)*l,i=(t.max.x-d.x)*l):(n=(t.max.x-d.x)*l,i=(t.min.x-d.x)*l),h>=0?(r=(t.min.y-d.y)*h,s=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,s=(t.min.y-d.y)*h),n>s||r>i||((r>n||isNaN(n))&&(n=r),(s<i||isNaN(i))&&(i=s),u>=0?(o=(t.min.z-d.z)*u,a=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,a=(t.min.z-d.z)*u),n>a||o>i)||((o>n||n!==n)&&(n=o),(a<i||i!==i)&&(i=a),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,vt)!==null}intersectTriangle(t,e,n,i,r){Tn.subVectors(e,t),Re.subVectors(n,t),Dn.crossVectors(Tn,Re);let s=this.direction.dot(Dn),o;if(s>0){if(i)return null;o=1}else if(s<0)o=-1,s=-s;else return null;Pt.subVectors(this.origin,t);let a=o*this.direction.dot(Re.crossVectors(Pt,Re));if(a<0)return null;let l=o*this.direction.dot(Tn.cross(Pt));if(l<0||a+l>s)return null;let h=-o*Pt.dot(Dn);return h<0?null:this.at(h/s,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},G=class c{constructor(t,e,n,i,r,s,o,a,l,h,u,d,f,p,m,v){c.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,s,o,a,l,h,u,d,f,p,m,v)}set(t,e,n,i,r,s,o,a,l,h,u,d,f,p,m,v){let g=this.elements;return g[0]=t,g[4]=e,g[8]=n,g[12]=i,g[1]=r,g[5]=s,g[9]=o,g[13]=a,g[2]=l,g[6]=h,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=v,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new c().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){let e=this.elements,n=t.elements,i=1/ie.setFromMatrixColumn(t,0).length(),r=1/ie.setFromMatrixColumn(t,1).length(),s=1/ie.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*s,e[9]=n[9]*s,e[10]=n[10]*s,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,i=t.y,r=t.z,s=Math.cos(n),o=Math.sin(n),a=Math.cos(i),l=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){let d=s*h,f=s*u,p=o*h,m=o*u;e[0]=a*h,e[4]=-a*u,e[8]=l,e[1]=f+p*l,e[5]=d-m*l,e[9]=-o*a,e[2]=m-d*l,e[6]=p+f*l,e[10]=s*a}else if(t.order==="YXZ"){let d=a*h,f=a*u,p=l*h,m=l*u;e[0]=d+m*o,e[4]=p*o-f,e[8]=s*l,e[1]=s*u,e[5]=s*h,e[9]=-o,e[2]=f*o-p,e[6]=m+d*o,e[10]=s*a}else if(t.order==="ZXY"){let d=a*h,f=a*u,p=l*h,m=l*u;e[0]=d-m*o,e[4]=-s*u,e[8]=p+f*o,e[1]=f+p*o,e[5]=s*h,e[9]=m-d*o,e[2]=-s*l,e[6]=o,e[10]=s*a}else if(t.order==="ZYX"){let d=s*h,f=s*u,p=o*h,m=o*u;e[0]=a*h,e[4]=p*l-f,e[8]=d*l+m,e[1]=a*u,e[5]=m*l+d,e[9]=f*l-p,e[2]=-l,e[6]=o*a,e[10]=s*a}else if(t.order==="YZX"){let d=s*a,f=s*l,p=o*a,m=o*l;e[0]=a*h,e[4]=m-d*u,e[8]=p*u+f,e[1]=u,e[5]=s*h,e[9]=-o*h,e[2]=-l*h,e[6]=f*u+p,e[10]=d-m*u}else if(t.order==="XZY"){let d=s*a,f=s*l,p=o*a,m=o*l;e[0]=a*h,e[4]=-u,e[8]=l*h,e[1]=d*u+m,e[5]=s*h,e[9]=f*u-p,e[2]=p*u-f,e[6]=o*h,e[10]=m*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Os,t,zs)}lookAt(t,e,n){let i=this.elements;return tt.subVectors(t,e),tt.lengthSq()===0&&(tt.z=1),tt.normalize(),St.crossVectors(n,tt),St.lengthSq()===0&&(Math.abs(n.z)===1?tt.x+=1e-4:tt.z+=1e-4,tt.normalize(),St.crossVectors(n,tt)),St.normalize(),Ie.crossVectors(tt,St),i[0]=St.x,i[4]=Ie.x,i[8]=tt.x,i[1]=St.y,i[5]=Ie.y,i[9]=tt.y,i[2]=St.z,i[6]=Ie.z,i[10]=tt.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,i=e.elements,r=this.elements,s=n[0],o=n[4],a=n[8],l=n[12],h=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],v=n[10],g=n[14],_=n[3],A=n[7],y=n[11],U=n[15],P=i[0],E=i[4],M=i[8],T=i[12],B=i[1],D=i[5],z=i[9],I=i[13],it=i[2],S=i[6],V=i[10],N=i[14],rt=i[3],R=i[7],q=i[11],$=i[15];return r[0]=s*P+o*B+a*it+l*rt,r[4]=s*E+o*D+a*S+l*R,r[8]=s*M+o*z+a*V+l*q,r[12]=s*T+o*I+a*N+l*$,r[1]=h*P+u*B+d*it+f*rt,r[5]=h*E+u*D+d*S+f*R,r[9]=h*M+u*z+d*V+f*q,r[13]=h*T+u*I+d*N+f*$,r[2]=p*P+m*B+v*it+g*rt,r[6]=p*E+m*D+v*S+g*R,r[10]=p*M+m*z+v*V+g*q,r[14]=p*T+m*I+v*N+g*$,r[3]=_*P+A*B+y*it+U*rt,r[7]=_*E+A*D+y*S+U*R,r[11]=_*M+A*z+y*V+U*q,r[15]=_*T+A*I+y*N+U*$,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],s=t[1],o=t[5],a=t[9],l=t[13],h=t[2],u=t[6],d=t[10],f=t[14],p=t[3],m=t[7],v=t[11],g=t[15];return p*(+r*a*u-i*l*u-r*o*d+n*l*d+i*o*f-n*a*f)+m*(+e*a*f-e*l*d+r*s*d-i*s*f+i*l*h-r*a*h)+v*(+e*l*u-e*o*f-r*s*u+n*s*f+r*o*h-n*l*h)+g*(-i*o*h-e*a*u+e*o*d+i*s*u-n*s*d+n*a*h)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],s=t[4],o=t[5],a=t[6],l=t[7],h=t[8],u=t[9],d=t[10],f=t[11],p=t[12],m=t[13],v=t[14],g=t[15],_=u*v*l-m*d*l+m*a*f-o*v*f-u*a*g+o*d*g,A=p*d*l-h*v*l-p*a*f+s*v*f+h*a*g-s*d*g,y=h*m*l-p*u*l+p*o*f-s*m*f-h*o*g+s*u*g,U=p*u*a-h*m*a-p*o*d+s*m*d+h*o*v-s*u*v,P=e*_+n*A+i*y+r*U;if(P===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let E=1/P;return t[0]=_*E,t[1]=(m*d*r-u*v*r-m*i*f+n*v*f+u*i*g-n*d*g)*E,t[2]=(o*v*r-m*a*r+m*i*l-n*v*l-o*i*g+n*a*g)*E,t[3]=(u*a*r-o*d*r-u*i*l+n*d*l+o*i*f-n*a*f)*E,t[4]=A*E,t[5]=(h*v*r-p*d*r+p*i*f-e*v*f-h*i*g+e*d*g)*E,t[6]=(p*a*r-s*v*r-p*i*l+e*v*l+s*i*g-e*a*g)*E,t[7]=(s*d*r-h*a*r+h*i*l-e*d*l-s*i*f+e*a*f)*E,t[8]=y*E,t[9]=(p*u*r-h*m*r-p*n*f+e*m*f+h*n*g-e*u*g)*E,t[10]=(s*m*r-p*o*r+p*n*l-e*m*l-s*n*g+e*o*g)*E,t[11]=(h*o*r-s*u*r-h*n*l+e*u*l+s*n*f-e*o*f)*E,t[12]=U*E,t[13]=(h*m*i-p*u*i+p*n*d-e*m*d-h*n*v+e*u*v)*E,t[14]=(p*o*i-s*m*i-p*n*a+e*m*a+s*n*v-e*o*v)*E,t[15]=(s*u*i-h*o*i+h*n*a-e*u*a-s*n*d+e*o*d)*E,this}scale(t){let e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),i=Math.sin(e),r=1-n,s=t.x,o=t.y,a=t.z,l=r*s,h=r*o;return this.set(l*s+n,l*o-i*a,l*a+i*o,0,l*o+i*a,h*o+n,h*a-i*s,0,l*a-i*o,h*a+i*s,r*a*a+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,s){return this.set(1,n,r,0,t,1,s,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){let i=this.elements,r=e._x,s=e._y,o=e._z,a=e._w,l=r+r,h=s+s,u=o+o,d=r*l,f=r*h,p=r*u,m=s*h,v=s*u,g=o*u,_=a*l,A=a*h,y=a*u,U=n.x,P=n.y,E=n.z;return i[0]=(1-(m+g))*U,i[1]=(f+y)*U,i[2]=(p-A)*U,i[3]=0,i[4]=(f-y)*P,i[5]=(1-(d+g))*P,i[6]=(v+_)*P,i[7]=0,i[8]=(p+A)*E,i[9]=(v-_)*E,i[10]=(1-(d+m))*E,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){let i=this.elements,r=ie.set(i[0],i[1],i[2]).length(),s=ie.set(i[4],i[5],i[6]).length(),o=ie.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],ct.copy(this);let l=1/r,h=1/s,u=1/o;return ct.elements[0]*=l,ct.elements[1]*=l,ct.elements[2]*=l,ct.elements[4]*=h,ct.elements[5]*=h,ct.elements[6]*=h,ct.elements[8]*=u,ct.elements[9]*=u,ct.elements[10]*=u,e.setFromRotationMatrix(ct),n.x=r,n.y=s,n.z=o,this}makePerspective(t,e,n,i,r,s,o=Gt){let a=this.elements,l=2*r/(e-t),h=2*r/(n-i),u=(e+t)/(e-t),d=(n+i)/(n-i),f,p;if(o===Gt)f=-(s+r)/(s-r),p=-2*s*r/(s-r);else if(o===$n)f=-s/(s-r),p=-s*r/(s-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return a[0]=l,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=h,a[9]=d,a[13]=0,a[2]=0,a[6]=0,a[10]=f,a[14]=p,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(t,e,n,i,r,s,o=Gt){let a=this.elements,l=1/(e-t),h=1/(n-i),u=1/(s-r),d=(e+t)*l,f=(n+i)*h,p,m;if(o===Gt)p=(s+r)*u,m=-2*u;else if(o===$n)p=r*u,m=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return a[0]=2*l,a[4]=0,a[8]=0,a[12]=-d,a[1]=0,a[5]=2*h,a[9]=0,a[13]=-f,a[2]=0,a[6]=0,a[10]=m,a[14]=-p,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},ie=new x,ct=new G,Os=new x(0,0,0),zs=new x(1,1,1),St=new x,Ie=new x,tt=new x,mr=new G,vr=new Bt,Qt=class c{constructor(t=0,e=0,n=0,i=c.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let i=t.elements,r=i[0],s=i[4],o=i[8],a=i[1],l=i[5],h=i[9],u=i[2],d=i[6],f=i[10];switch(e){case"XYZ":this._y=Math.asin(Z(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-s,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Z(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(a,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Z(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-s,l)):(this._y=0,this._z=Math.atan2(a,r));break;case"ZYX":this._y=Math.asin(-Z(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(a,r)):(this._x=0,this._z=Math.atan2(-s,l));break;case"YZX":this._z=Math.asin(Z(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Z(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return mr.makeRotationFromQuaternion(t),this.setFromRotationMatrix(mr,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return vr.setFromEuler(this),this.setFromQuaternion(vr,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Qt.DEFAULT_ORDER="XYZ";var ii=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Hs=0,gr=new x,re=new Bt,gt=new G,Ne=new x,Ue=new x,Vs=new x,Gs=new Bt,xr=new x(1,0,0),Ar=new x(0,1,0),yr=new x(0,0,1),Ur={type:"added"},qs={type:"removed"},se={type:"childadded",child:null},Bn={type:"childremoved",child:null},nt=class c extends qt{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Hs++}),this.uuid=Se(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=c.DEFAULT_UP.clone();let t=new x,e=new Qt,n=new Bt,i=new x(1,1,1);function r(){n.setFromEuler(e,!1)}function s(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new G},normalMatrix:{value:new C}}),this.matrix=new G,this.matrixWorld=new G,this.matrixAutoUpdate=c.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=c.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ii,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return re.setFromAxisAngle(t,e),this.quaternion.multiply(re),this}rotateOnWorldAxis(t,e){return re.setFromAxisAngle(t,e),this.quaternion.premultiply(re),this}rotateX(t){return this.rotateOnAxis(xr,t)}rotateY(t){return this.rotateOnAxis(Ar,t)}rotateZ(t){return this.rotateOnAxis(yr,t)}translateOnAxis(t,e){return gr.copy(t).applyQuaternion(this.quaternion),this.position.add(gr.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(xr,t)}translateY(t){return this.translateOnAxis(Ar,t)}translateZ(t){return this.translateOnAxis(yr,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(gt.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Ne.copy(t):Ne.set(t,e,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Ue.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?gt.lookAt(Ue,Ne,this.up):gt.lookAt(Ne,Ue,this.up),this.quaternion.setFromRotationMatrix(gt),i&&(gt.extractRotation(i.matrixWorld),re.setFromRotationMatrix(gt),this.quaternion.premultiply(re.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Ur),se.child=t,this.dispatchEvent(se),se.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(qs),Bn.child=t,this.dispatchEvent(Bn),Bn.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),gt.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),gt.multiply(t.parent.matrixWorld)),t.applyMatrix4(gt),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Ur),se.child=t,this.dispatchEvent(se),se.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){let s=this.children[n].getObjectByProperty(t,e);if(s!==void 0)return s}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ue,t,Vs),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ue,Gs,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){let n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){let i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].updateWorldMatrix(!1,!0)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,a){return o[a.uuid]===void 0&&(o[a.uuid]=a.toJSON(t)),a.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let a=o.shapes;if(Array.isArray(a))for(let l=0,h=a.length;l<h;l++){let u=a[l];r(t.shapes,u)}else r(t.shapes,a)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(r(t.materials,this.material[a]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let a=this.animations[o];i.animations.push(r(t.animations,a))}}if(e){let o=s(t.geometries),a=s(t.materials),l=s(t.textures),h=s(t.images),u=s(t.shapes),d=s(t.skeletons),f=s(t.animations),p=s(t.nodes);o.length>0&&(n.geometries=o),a.length>0&&(n.materials=a),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),p.length>0&&(n.nodes=p)}return n.object=i,n;function s(o){let a=[];for(let l in o){let h=o[l];delete h.metadata,a.push(h)}return a}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let i=t.children[n];this.add(i.clone())}return this}};nt.DEFAULT_UP=new x(0,1,0);nt.DEFAULT_MATRIX_AUTO_UPDATE=!0;nt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var lt=new x,xt=new x,Ln=new x,At=new x,oe=new x,ae=new x,_r=new x,kn=new x,Rn=new x,In=new x,Nn=new ft,Fn=new ft,On=new ft,Ht=class c{constructor(t=new x,e=new x,n=new x){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),lt.subVectors(t,e),i.cross(lt);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){lt.subVectors(i,e),xt.subVectors(n,e),Ln.subVectors(t,e);let s=lt.dot(lt),o=lt.dot(xt),a=lt.dot(Ln),l=xt.dot(xt),h=xt.dot(Ln),u=s*l-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,f=(l*a-o*h)*d,p=(s*h-o*a)*d;return r.set(1-f-p,p,f)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,At)===null?!1:At.x>=0&&At.y>=0&&At.x+At.y<=1}static getInterpolation(t,e,n,i,r,s,o,a){return this.getBarycoord(t,e,n,i,At)===null?(a.x=0,a.y=0,"z"in a&&(a.z=0),"w"in a&&(a.w=0),null):(a.setScalar(0),a.addScaledVector(r,At.x),a.addScaledVector(s,At.y),a.addScaledVector(o,At.z),a)}static getInterpolatedAttribute(t,e,n,i,r,s){return Nn.setScalar(0),Fn.setScalar(0),On.setScalar(0),Nn.fromBufferAttribute(t,e),Fn.fromBufferAttribute(t,n),On.fromBufferAttribute(t,i),s.setScalar(0),s.addScaledVector(Nn,r.x),s.addScaledVector(Fn,r.y),s.addScaledVector(On,r.z),s}static isFrontFacing(t,e,n,i){return lt.subVectors(n,e),xt.subVectors(t,e),lt.cross(xt).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return lt.subVectors(this.c,this.b),xt.subVectors(this.a,this.b),lt.cross(xt).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return c.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return c.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,i,r){return c.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return c.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return c.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,i=this.b,r=this.c,s,o;oe.subVectors(i,n),ae.subVectors(r,n),kn.subVectors(t,n);let a=oe.dot(kn),l=ae.dot(kn);if(a<=0&&l<=0)return e.copy(n);Rn.subVectors(t,i);let h=oe.dot(Rn),u=ae.dot(Rn);if(h>=0&&u<=h)return e.copy(i);let d=a*u-h*l;if(d<=0&&a>=0&&h<=0)return s=a/(a-h),e.copy(n).addScaledVector(oe,s);In.subVectors(t,r);let f=oe.dot(In),p=ae.dot(In);if(p>=0&&f<=p)return e.copy(r);let m=f*l-a*p;if(m<=0&&l>=0&&p<=0)return o=l/(l-p),e.copy(n).addScaledVector(ae,o);let v=h*p-f*u;if(v<=0&&u-h>=0&&f-p>=0)return _r.subVectors(r,i),o=(u-h)/(u-h+(f-p)),e.copy(i).addScaledVector(_r,o);let g=1/(v+m+d);return s=m*g,o=d*g,e.copy(n).addScaledVector(oe,s).addScaledVector(ae,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},Qr={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ct={h:0,s:0,l:0},Fe={h:0,s:0,l:0};function zn(c,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?c+(t-c)*6*e:e<1/2?t:e<2/3?c+(t-c)*6*(2/3-e):c}var L=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=j){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ot.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=ot.workingColorSpace){return this.r=t,this.g=e,this.b=n,ot.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=ot.workingColorSpace){if(t=ks(t,1),e=Z(e,0,1),n=Z(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,s=2*n-r;this.r=zn(s,r,t+1/3),this.g=zn(s,r,t),this.b=zn(s,r,t-1/3)}return ot.toWorkingColorSpace(this,i),this}setStyle(t,e=j){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=i[1],s=r.length;if(s===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(s===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=j){let n=Qr[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Ut(t.r),this.g=Ut(t.g),this.b=Ut(t.b),this}copyLinearToSRGB(t){return this.r=ue(t.r),this.g=ue(t.g),this.b=ue(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=j){return ot.fromWorkingColorSpace(Q.copy(this),t),Math.round(Z(Q.r*255,0,255))*65536+Math.round(Z(Q.g*255,0,255))*256+Math.round(Z(Q.b*255,0,255))}getHexString(t=j){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ot.workingColorSpace){ot.fromWorkingColorSpace(Q.copy(this),e);let n=Q.r,i=Q.g,r=Q.b,s=Math.max(n,i,r),o=Math.min(n,i,r),a,l,h=(o+s)/2;if(o===s)a=0,l=0;else{let u=s-o;switch(l=h<=.5?u/(s+o):u/(2-s-o),s){case n:a=(i-r)/u+(i<r?6:0);break;case i:a=(r-n)/u+2;break;case r:a=(n-i)/u+4;break}a/=6}return t.h=a,t.s=l,t.l=h,t}getRGB(t,e=ot.workingColorSpace){return ot.fromWorkingColorSpace(Q.copy(this),e),t.r=Q.r,t.g=Q.g,t.b=Q.b,t}getStyle(t=j){ot.fromWorkingColorSpace(Q.copy(this),t);let e=Q.r,n=Q.g,i=Q.b;return t!==j?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(Ct),this.setHSL(Ct.h+t,Ct.s+e,Ct.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Ct),t.getHSL(Fe);let n=bn(Ct.h,Fe.h,e),i=bn(Ct.s,Fe.s,e),r=bn(Ct.l,Fe.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Q=new L;L.NAMES=Qr;var Ws=0,nn=class extends qt{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ws++}),this.uuid=Se(),this.name="",this.blending=je,this.side=jn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Gi,this.blendDst=qi,this.blendEquation=Vi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new L(0,0,0),this.blendAlpha=0,this.depthFunc=Ze,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=sr,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Jt,this.stencilZFail=Jt,this.stencilZPass=Jt,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}let i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==je&&(n.blending=this.blending),this.side!==jn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Gi&&(n.blendSrc=this.blendSrc),this.blendDst!==qi&&(n.blendDst=this.blendDst),this.blendEquation!==Vi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ze&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==sr&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Jt&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Jt&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Jt&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let s=[];for(let o in r){let a=r[o];delete a.metadata,s.push(a)}return s}if(e){let r=i(t.textures),s=i(t.images);r.length>0&&(n.textures=r),s.length>0&&(n.images=s)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}},de=class extends nn{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new L(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qt,this.combine=ws,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}};var F=new x,Oe=new O,X=class{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=or,this.updateRanges=[],this.gpuType=bi,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Oe.fromBufferAttribute(this,e),Oe.applyMatrix3(t),this.setXY(e,Oe.x,Oe.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)F.fromBufferAttribute(this,e),F.applyMatrix3(t),this.setXYZ(e,F.x,F.y,F.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)F.fromBufferAttribute(this,e),F.applyMatrix4(t),this.setXYZ(e,F.x,F.y,F.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)F.fromBufferAttribute(this,e),F.applyNormalMatrix(t),this.setXYZ(e,F.x,F.y,F.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)F.fromBufferAttribute(this,e),F.transformDirection(t),this.setXYZ(e,F.x,F.y,F.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=xe(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=K(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=xe(e,this.array)),e}setX(t,e){return this.normalized&&(e=K(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=xe(e,this.array)),e}setY(t,e){return this.normalized&&(e=K(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=xe(e,this.array)),e}setZ(t,e){return this.normalized&&(e=K(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=xe(e,this.array)),e}setW(t,e){return this.normalized&&(e=K(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=K(e,this.array),n=K(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=K(e,this.array),n=K(n,this.array),i=K(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=K(e,this.array),n=K(n,this.array),i=K(i,this.array),r=K(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==or&&(t.usage=this.usage),t}};var ri=class extends X{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var si=class extends X{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var _t=class extends X{constructor(t,e,n){super(new Float32Array(t),e,n)}},Qs=0,st=new G,Hn=new nt,ce=new x,et=new Wt,_e=new Wt,H=new x,Lt=class c extends qt{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Qs++}),this.uuid=Se(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Rs(t)?si:ri)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new C().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return st.makeRotationFromQuaternion(t),this.applyMatrix4(st),this}rotateX(t){return st.makeRotationX(t),this.applyMatrix4(st),this}rotateY(t){return st.makeRotationY(t),this.applyMatrix4(st),this}rotateZ(t){return st.makeRotationZ(t),this.applyMatrix4(st),this}translate(t,e,n){return st.makeTranslation(t,e,n),this.applyMatrix4(st),this}scale(t,e,n){return st.makeScale(t,e,n),this.applyMatrix4(st),this}lookAt(t){return Hn.lookAt(t),Hn.updateMatrix(),this.applyMatrix4(Hn.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ce).negate(),this.translate(ce.x,ce.y,ce.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let i=0,r=t.length;i<r;i++){let s=t[i];n.push(s.x,s.y,s.z||0)}this.setAttribute("position",new _t(n,3))}else{for(let n=0,i=e.count;n<i;n++){let r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Wt);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new x(-1/0,-1/0,-1/0),new x(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){let r=e[n];et.setFromBufferAttribute(r),this.morphTargetsRelative?(H.addVectors(this.boundingBox.min,et.min),this.boundingBox.expandByPoint(H),H.addVectors(this.boundingBox.max,et.max),this.boundingBox.expandByPoint(H)):(this.boundingBox.expandByPoint(et.min),this.boundingBox.expandByPoint(et.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ee);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new x,1/0);return}if(t){let n=this.boundingSphere.center;if(et.setFromBufferAttribute(t),e)for(let r=0,s=e.length;r<s;r++){let o=e[r];_e.setFromBufferAttribute(o),this.morphTargetsRelative?(H.addVectors(et.min,_e.min),et.expandByPoint(H),H.addVectors(et.max,_e.max),et.expandByPoint(H)):(et.expandByPoint(_e.min),et.expandByPoint(_e.max))}et.getCenter(n);let i=0;for(let r=0,s=t.count;r<s;r++)H.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(H));if(e)for(let r=0,s=e.length;r<s;r++){let o=e[r],a=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)H.fromBufferAttribute(o,l),a&&(ce.fromBufferAttribute(t,l),H.add(ce)),i=Math.max(i,n.distanceToSquared(H))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,i=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new X(new Float32Array(4*n.count),4));let s=this.getAttribute("tangent"),o=[],a=[];for(let M=0;M<n.count;M++)o[M]=new x,a[M]=new x;let l=new x,h=new x,u=new x,d=new O,f=new O,p=new O,m=new x,v=new x;function g(M,T,B){l.fromBufferAttribute(n,M),h.fromBufferAttribute(n,T),u.fromBufferAttribute(n,B),d.fromBufferAttribute(r,M),f.fromBufferAttribute(r,T),p.fromBufferAttribute(r,B),h.sub(l),u.sub(l),f.sub(d),p.sub(d);let D=1/(f.x*p.y-p.x*f.y);isFinite(D)&&(m.copy(h).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(D),v.copy(u).multiplyScalar(f.x).addScaledVector(h,-p.x).multiplyScalar(D),o[M].add(m),o[T].add(m),o[B].add(m),a[M].add(v),a[T].add(v),a[B].add(v))}let _=this.groups;_.length===0&&(_=[{start:0,count:t.count}]);for(let M=0,T=_.length;M<T;++M){let B=_[M],D=B.start,z=B.count;for(let I=D,it=D+z;I<it;I+=3)g(t.getX(I+0),t.getX(I+1),t.getX(I+2))}let A=new x,y=new x,U=new x,P=new x;function E(M){U.fromBufferAttribute(i,M),P.copy(U);let T=o[M];A.copy(T),A.sub(U.multiplyScalar(U.dot(T))).normalize(),y.crossVectors(P,T);let D=y.dot(a[M])<0?-1:1;s.setXYZW(M,A.x,A.y,A.z,D)}for(let M=0,T=_.length;M<T;++M){let B=_[M],D=B.start,z=B.count;for(let I=D,it=D+z;I<it;I+=3)E(t.getX(I+0)),E(t.getX(I+1)),E(t.getX(I+2))}}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new X(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let i=new x,r=new x,s=new x,o=new x,a=new x,l=new x,h=new x,u=new x;if(t)for(let d=0,f=t.count;d<f;d+=3){let p=t.getX(d+0),m=t.getX(d+1),v=t.getX(d+2);i.fromBufferAttribute(e,p),r.fromBufferAttribute(e,m),s.fromBufferAttribute(e,v),h.subVectors(s,r),u.subVectors(i,r),h.cross(u),o.fromBufferAttribute(n,p),a.fromBufferAttribute(n,m),l.fromBufferAttribute(n,v),o.add(h),a.add(h),l.add(h),n.setXYZ(p,o.x,o.y,o.z),n.setXYZ(m,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z)}else for(let d=0,f=e.count;d<f;d+=3)i.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),s.fromBufferAttribute(e,d+2),h.subVectors(s,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)H.fromBufferAttribute(t,e),H.normalize(),t.setXYZ(e,H.x,H.y,H.z)}toNonIndexed(){function t(o,a){let l=o.array,h=o.itemSize,u=o.normalized,d=new l.constructor(a.length*h),f=0,p=0;for(let m=0,v=a.length;m<v;m++){o.isInterleavedBufferAttribute?f=a[m]*o.data.stride+o.offset:f=a[m]*h;for(let g=0;g<h;g++)d[p++]=l[f++]}return new X(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new c,n=this.index.array,i=this.attributes;for(let o in i){let a=i[o],l=t(a,n);e.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let a=[],l=r[o];for(let h=0,u=l.length;h<u;h++){let d=l[h],f=t(d,n);a.push(f)}e.morphAttributes[o]=a}e.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,a=s.length;o<a;o++){let l=s[o];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){let t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){let a=this.parameters;for(let l in a)a[l]!==void 0&&(t[l]=a[l]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let a in n){let l=n[a];t.data.attributes[a]=l.toJSON(t.data)}let i={},r=!1;for(let a in this.morphAttributes){let l=this.morphAttributes[a],h=[];for(let u=0,d=l.length;u<d;u++){let f=l[u];h.push(f.toJSON(t.data))}h.length>0&&(i[a]=h,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);let s=this.groups;s.length>0&&(t.data.groups=JSON.parse(JSON.stringify(s)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone(e));let i=t.attributes;for(let l in i){let h=i[l];this.setAttribute(l,h.clone(e))}let r=t.morphAttributes;for(let l in r){let h=[],u=r[l];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;let s=t.groups;for(let l=0,h=s.length;l<h;l++){let u=s[l];this.addGroup(u.start,u.count,u.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let a=t.boundingSphere;return a!==null&&(this.boundingSphere=a.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},br=new G,Ft=new ni,ze=new Ee,Er=new x,He=new x,Ve=new x,Ge=new x,Vn=new x,qe=new x,Mr=new x,We=new x,dt=class extends nt{constructor(t=new Lt,e=new de){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,s=n.morphTargetsRelative;e.fromBufferAttribute(i,t);let o=this.morphTargetInfluences;if(r&&o){qe.set(0,0,0);for(let a=0,l=r.length;a<l;a++){let h=o[a],u=r[a];h!==0&&(Vn.fromBufferAttribute(u,t),s?qe.addScaledVector(Vn,h):qe.addScaledVector(Vn.sub(e),h))}e.add(qe)}return e}raycast(t,e){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ze.copy(n.boundingSphere),ze.applyMatrix4(r),Ft.copy(t.ray).recast(t.near),!(ze.containsPoint(Ft.origin)===!1&&(Ft.intersectSphere(ze,Er)===null||Ft.origin.distanceToSquared(Er)>(t.far-t.near)**2))&&(br.copy(r).invert(),Ft.copy(t.ray).applyMatrix4(br),!(n.boundingBox!==null&&Ft.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ft)))}_computeIntersections(t,e,n){let i,r=this.geometry,s=this.material,o=r.index,a=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(s))for(let p=0,m=d.length;p<m;p++){let v=d[p],g=s[v.materialIndex],_=Math.max(v.start,f.start),A=Math.min(o.count,Math.min(v.start+v.count,f.start+f.count));for(let y=_,U=A;y<U;y+=3){let P=o.getX(y),E=o.getX(y+1),M=o.getX(y+2);i=Qe(this,g,t,n,l,h,u,P,E,M),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=v.materialIndex,e.push(i))}}else{let p=Math.max(0,f.start),m=Math.min(o.count,f.start+f.count);for(let v=p,g=m;v<g;v+=3){let _=o.getX(v),A=o.getX(v+1),y=o.getX(v+2);i=Qe(this,s,t,n,l,h,u,_,A,y),i&&(i.faceIndex=Math.floor(v/3),e.push(i))}}else if(a!==void 0)if(Array.isArray(s))for(let p=0,m=d.length;p<m;p++){let v=d[p],g=s[v.materialIndex],_=Math.max(v.start,f.start),A=Math.min(a.count,Math.min(v.start+v.count,f.start+f.count));for(let y=_,U=A;y<U;y+=3){let P=y,E=y+1,M=y+2;i=Qe(this,g,t,n,l,h,u,P,E,M),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=v.materialIndex,e.push(i))}}else{let p=Math.max(0,f.start),m=Math.min(a.count,f.start+f.count);for(let v=p,g=m;v<g;v+=3){let _=v,A=v+1,y=v+2;i=Qe(this,s,t,n,l,h,u,_,A,y),i&&(i.faceIndex=Math.floor(v/3),e.push(i))}}}};function Ys(c,t,e,n,i,r,s,o){let a;if(t.side===Fr?a=n.intersectTriangle(s,r,i,!0,o):a=n.intersectTriangle(i,r,s,t.side===jn,o),a===null)return null;We.copy(o),We.applyMatrix4(c.matrixWorld);let l=e.ray.origin.distanceTo(We);return l<e.near||l>e.far?null:{distance:l,point:We.clone(),object:c}}function Qe(c,t,e,n,i,r,s,o,a,l){c.getVertexPosition(o,He),c.getVertexPosition(a,Ve),c.getVertexPosition(l,Ge);let h=Ys(c,t,e,n,He,Ve,Ge,Mr);if(h){let u=new x;Ht.getBarycoord(Mr,He,Ve,Ge,u),i&&(h.uv=Ht.getInterpolatedAttribute(i,o,a,l,u,new O)),r&&(h.uv1=Ht.getInterpolatedAttribute(r,o,a,l,u,new O)),s&&(h.normal=Ht.getInterpolatedAttribute(s,o,a,l,u,new x),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:a,c:l,normal:new x,materialIndex:0};Ht.getNormal(He,Ve,Ge,d.normal),h.face=d,h.barycoord=u}return h}var oi=class c extends Lt{constructor(t=1,e=1,n=1,i=1,r=1,s=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:s};let o=this;i=Math.floor(i),r=Math.floor(r),s=Math.floor(s);let a=[],l=[],h=[],u=[],d=0,f=0;p("z","y","x",-1,-1,n,e,t,s,r,0),p("z","y","x",1,-1,n,e,-t,s,r,1),p("x","z","y",1,1,t,n,e,i,s,2),p("x","z","y",1,-1,t,n,-e,i,s,3),p("x","y","z",1,-1,t,e,n,i,r,4),p("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(a),this.setAttribute("position",new _t(l,3)),this.setAttribute("normal",new _t(h,3)),this.setAttribute("uv",new _t(u,2));function p(m,v,g,_,A,y,U,P,E,M,T){let B=y/E,D=U/M,z=y/2,I=U/2,it=P/2,S=E+1,V=M+1,N=0,rt=0,R=new x;for(let q=0;q<V;q++){let $=q*D-I;for(let Zt=0;Zt<S;Zt++){let Te=Zt*B-z;R[m]=Te*_,R[v]=$*A,R[g]=it,l.push(R.x,R.y,R.z),R[m]=0,R[v]=0,R[g]=P>0?1:-1,h.push(R.x,R.y,R.z),u.push(Zt/E),u.push(1-q/M),N+=1}}for(let q=0;q<M;q++)for(let $=0;$<E;$++){let Zt=d+$+S*q,Te=d+$+S*(q+1),Cs=d+($+1)+S*(q+1),Hi=d+($+1)+S*q;a.push(Zt,Te,Hi),a.push(Te,Cs,Hi),rt+=6}o.addGroup(f,rt,T),f+=rt,d+=N}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new c(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};function Ei(c){let t={};for(let e in c){t[e]={};for(let n in c[e]){let i=c[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Y(c){let t={};for(let e=0;e<c.length;e++){let n=Ei(c[e]);for(let i in n)t[i]=n[i]}return t}function Xs(c){let t=[];for(let e=0;e<c.length;e++)t.push(c[e].clone());return t}var Yr={clone:Ei,merge:Y},Ks=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,js=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,pt=class extends nn{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ks,this.fragmentShader=js,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Ei(t.uniforms),this.uniformsGroups=Xs(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let i in this.uniforms){let s=this.uniforms[i].value;s&&s.isTexture?e.uniforms[i]={type:"t",value:s.toJSON(t).uuid}:s&&s.isColor?e.uniforms[i]={type:"c",value:s.getHex()}:s&&s.isVector2?e.uniforms[i]={type:"v2",value:s.toArray()}:s&&s.isVector3?e.uniforms[i]={type:"v3",value:s.toArray()}:s&&s.isVector4?e.uniforms[i]={type:"v4",value:s.toArray()}:s&&s.isMatrix3?e.uniforms[i]={type:"m3",value:s.toArray()}:s&&s.isMatrix4?e.uniforms[i]={type:"m4",value:s.toArray()}:e.uniforms[i]={value:s}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}},fe=class extends nt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new G,this.projectionMatrix=new G,this.projectionMatrixInverse=new G,this.coordinateSystem=Gt}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},wt=new x,Pr=new O,Sr=new O,ai=class extends fe{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=ar*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(_n*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return ar*2*Math.atan(Math.tan(_n*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){wt.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(wt.x,wt.y).multiplyScalar(-t/wt.z),wt.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(wt.x,wt.y).multiplyScalar(-t/wt.z)}getViewSize(t,e){return this.getViewBounds(t,Pr,Sr),e.subVectors(Sr,Pr)}setViewOffset(t,e,n,i,r,s){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(_n*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i,s=this.view;if(this.view!==null&&this.view.enabled){let a=s.fullWidth,l=s.fullHeight;r+=s.offsetX*i/a,e-=s.offsetY*n/l,i*=s.width/a,n*=s.height/l}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var Gn=new x,Zs=new x,Js=new C,Tt=class{constructor(t=new x(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let i=Gn.subVectors(n,e).cross(Zs.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){let n=t.delta(Gn),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Js.getNormalMatrix(t),i=this.coplanarPoint(Gn).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Ot=new Ee,Ye=new x,ci=class{constructor(t=new Tt,e=new Tt,n=new Tt,i=new Tt,r=new Tt,s=new Tt){this.planes=[t,e,n,i,r,s]}set(t,e,n,i,r,s){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(s),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Gt){let n=this.planes,i=t.elements,r=i[0],s=i[1],o=i[2],a=i[3],l=i[4],h=i[5],u=i[6],d=i[7],f=i[8],p=i[9],m=i[10],v=i[11],g=i[12],_=i[13],A=i[14],y=i[15];if(n[0].setComponents(a-r,d-l,v-f,y-g).normalize(),n[1].setComponents(a+r,d+l,v+f,y+g).normalize(),n[2].setComponents(a+s,d+h,v+p,y+_).normalize(),n[3].setComponents(a-s,d-h,v-p,y-_).normalize(),n[4].setComponents(a-o,d-u,v-m,y-A).normalize(),e===Gt)n[5].setComponents(a+o,d+u,v+m,y+A).normalize();else if(e===$n)n[5].setComponents(o,u,m,A).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ot.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Ot.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ot)}intersectsSprite(t){return Ot.center.set(0,0,0),Ot.radius=.7071067811865476,Ot.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ot)}intersectsSphere(t){let e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let i=e[n];if(Ye.x=i.normal.x>0?t.max.x:t.min.x,Ye.y=i.normal.y>0?t.max.y:t.min.y,Ye.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(Ye)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var rn=class c extends Lt{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};let r=t/2,s=e/2,o=Math.floor(n),a=Math.floor(i),l=o+1,h=a+1,u=t/o,d=e/a,f=[],p=[],m=[],v=[];for(let g=0;g<h;g++){let _=g*d-s;for(let A=0;A<l;A++){let y=A*u-r;p.push(y,-_,0),m.push(0,0,1),v.push(A/o),v.push(1-g/a)}}for(let g=0;g<a;g++)for(let _=0;_<o;_++){let A=_+l*g,y=_+l*(g+1),U=_+1+l*(g+1),P=_+1+l*g;f.push(A,y,P),f.push(y,U,P)}this.setIndex(f),this.setAttribute("position",new _t(p,3)),this.setAttribute("normal",new _t(m,3)),this.setAttribute("uv",new _t(v,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new c(t.width,t.height,t.widthSegments,t.heightSegments)}},$s=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,to=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,eo=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,no=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,io=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ro=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,so=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,oo=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ao=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,co=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,lo=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,ho=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,uo=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,fo=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,po=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,mo=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,vo=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,go=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,xo=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Ao=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,yo=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Uo=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,_o=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,bo=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Eo=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Mo=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Po=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,So=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Co=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,wo=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,To="gl_FragColor = linearToOutputTexel( gl_FragColor );",Do=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Bo=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Lo=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,ko=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ro=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Io=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,No=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Fo=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Oo=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,zo=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Ho=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Vo=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Go=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,qo=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Wo=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Qo=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Yo=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Xo=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Ko=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,jo=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Zo=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Jo=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,$o=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ta=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ea=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,na=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ia=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ra=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,sa=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,oa=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,aa=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ca=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,la=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ha=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,ua=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,da=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,fa=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,pa=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ma=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,va=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ga=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,xa=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Aa=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ya=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ua=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,_a=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,ba=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ea=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ma=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Pa=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Sa=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Ca=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,wa=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Ta=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Da=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Ba=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,La=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,ka=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Ra=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Ia=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Na=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Fa=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Oa=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,za=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Ha=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Va=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Ga=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,qa=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Wa=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Qa=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Ya=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Xa=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ka=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,ja=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Za=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Ja=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,$a=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,tc=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ec=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,nc=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ic=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,rc=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,sc=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,oc=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,ac=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,cc=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,lc=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,hc=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,uc=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,dc=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,fc=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,pc=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,mc=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,vc=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gc=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,xc=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ac=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,yc=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Uc=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_c=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bc=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Ec=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Mc=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Pc=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Sc=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Cc=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,wc=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Tc=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Dc=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Bc=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,w={alphahash_fragment:$s,alphahash_pars_fragment:to,alphamap_fragment:eo,alphamap_pars_fragment:no,alphatest_fragment:io,alphatest_pars_fragment:ro,aomap_fragment:so,aomap_pars_fragment:oo,batching_pars_vertex:ao,batching_vertex:co,begin_vertex:lo,beginnormal_vertex:ho,bsdfs:uo,iridescence_fragment:fo,bumpmap_pars_fragment:po,clipping_planes_fragment:mo,clipping_planes_pars_fragment:vo,clipping_planes_pars_vertex:go,clipping_planes_vertex:xo,color_fragment:Ao,color_pars_fragment:yo,color_pars_vertex:Uo,color_vertex:_o,common:bo,cube_uv_reflection_fragment:Eo,defaultnormal_vertex:Mo,displacementmap_pars_vertex:Po,displacementmap_vertex:So,emissivemap_fragment:Co,emissivemap_pars_fragment:wo,colorspace_fragment:To,colorspace_pars_fragment:Do,envmap_fragment:Bo,envmap_common_pars_fragment:Lo,envmap_pars_fragment:ko,envmap_pars_vertex:Ro,envmap_physical_pars_fragment:Qo,envmap_vertex:Io,fog_vertex:No,fog_pars_vertex:Fo,fog_fragment:Oo,fog_pars_fragment:zo,gradientmap_pars_fragment:Ho,lightmap_pars_fragment:Vo,lights_lambert_fragment:Go,lights_lambert_pars_fragment:qo,lights_pars_begin:Wo,lights_toon_fragment:Yo,lights_toon_pars_fragment:Xo,lights_phong_fragment:Ko,lights_phong_pars_fragment:jo,lights_physical_fragment:Zo,lights_physical_pars_fragment:Jo,lights_fragment_begin:$o,lights_fragment_maps:ta,lights_fragment_end:ea,logdepthbuf_fragment:na,logdepthbuf_pars_fragment:ia,logdepthbuf_pars_vertex:ra,logdepthbuf_vertex:sa,map_fragment:oa,map_pars_fragment:aa,map_particle_fragment:ca,map_particle_pars_fragment:la,metalnessmap_fragment:ha,metalnessmap_pars_fragment:ua,morphinstance_vertex:da,morphcolor_vertex:fa,morphnormal_vertex:pa,morphtarget_pars_vertex:ma,morphtarget_vertex:va,normal_fragment_begin:ga,normal_fragment_maps:xa,normal_pars_fragment:Aa,normal_pars_vertex:ya,normal_vertex:Ua,normalmap_pars_fragment:_a,clearcoat_normal_fragment_begin:ba,clearcoat_normal_fragment_maps:Ea,clearcoat_pars_fragment:Ma,iridescence_pars_fragment:Pa,opaque_fragment:Sa,packing:Ca,premultiplied_alpha_fragment:wa,project_vertex:Ta,dithering_fragment:Da,dithering_pars_fragment:Ba,roughnessmap_fragment:La,roughnessmap_pars_fragment:ka,shadowmap_pars_fragment:Ra,shadowmap_pars_vertex:Ia,shadowmap_vertex:Na,shadowmask_pars_fragment:Fa,skinbase_vertex:Oa,skinning_pars_vertex:za,skinning_vertex:Ha,skinnormal_vertex:Va,specularmap_fragment:Ga,specularmap_pars_fragment:qa,tonemapping_fragment:Wa,tonemapping_pars_fragment:Qa,transmission_fragment:Ya,transmission_pars_fragment:Xa,uv_pars_fragment:Ka,uv_pars_vertex:ja,uv_vertex:Za,worldpos_vertex:Ja,background_vert:$a,background_frag:tc,backgroundCube_vert:ec,backgroundCube_frag:nc,cube_vert:ic,cube_frag:rc,depth_vert:sc,depth_frag:oc,distanceRGBA_vert:ac,distanceRGBA_frag:cc,equirect_vert:lc,equirect_frag:hc,linedashed_vert:uc,linedashed_frag:dc,meshbasic_vert:fc,meshbasic_frag:pc,meshlambert_vert:mc,meshlambert_frag:vc,meshmatcap_vert:gc,meshmatcap_frag:xc,meshnormal_vert:Ac,meshnormal_frag:yc,meshphong_vert:Uc,meshphong_frag:_c,meshphysical_vert:bc,meshphysical_frag:Ec,meshtoon_vert:Mc,meshtoon_frag:Pc,points_vert:Sc,points_frag:Cc,shadow_vert:wc,shadow_frag:Tc,sprite_vert:Dc,sprite_frag:Bc},b={common:{diffuse:{value:new L(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new C},alphaMap:{value:null},alphaMapTransform:{value:new C},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new C}},envmap:{envMap:{value:null},envMapRotation:{value:new C},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new C}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new C}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new C},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new C},normalScale:{value:new O(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new C},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new C}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new C}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new C}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new L(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new L(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new C},alphaTest:{value:0},uvTransform:{value:new C}},sprite:{diffuse:{value:new L(16777215)},opacity:{value:1},center:{value:new O(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new C},alphaMap:{value:null},alphaMapTransform:{value:new C},alphaTest:{value:0}}},Cr={basic:{uniforms:Y([b.common,b.specularmap,b.envmap,b.aomap,b.lightmap,b.fog]),vertexShader:w.meshbasic_vert,fragmentShader:w.meshbasic_frag},lambert:{uniforms:Y([b.common,b.specularmap,b.envmap,b.aomap,b.lightmap,b.emissivemap,b.bumpmap,b.normalmap,b.displacementmap,b.fog,b.lights,{emissive:{value:new L(0)}}]),vertexShader:w.meshlambert_vert,fragmentShader:w.meshlambert_frag},phong:{uniforms:Y([b.common,b.specularmap,b.envmap,b.aomap,b.lightmap,b.emissivemap,b.bumpmap,b.normalmap,b.displacementmap,b.fog,b.lights,{emissive:{value:new L(0)},specular:{value:new L(1118481)},shininess:{value:30}}]),vertexShader:w.meshphong_vert,fragmentShader:w.meshphong_frag},standard:{uniforms:Y([b.common,b.envmap,b.aomap,b.lightmap,b.emissivemap,b.bumpmap,b.normalmap,b.displacementmap,b.roughnessmap,b.metalnessmap,b.fog,b.lights,{emissive:{value:new L(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:w.meshphysical_vert,fragmentShader:w.meshphysical_frag},toon:{uniforms:Y([b.common,b.aomap,b.lightmap,b.emissivemap,b.bumpmap,b.normalmap,b.displacementmap,b.gradientmap,b.fog,b.lights,{emissive:{value:new L(0)}}]),vertexShader:w.meshtoon_vert,fragmentShader:w.meshtoon_frag},matcap:{uniforms:Y([b.common,b.bumpmap,b.normalmap,b.displacementmap,b.fog,{matcap:{value:null}}]),vertexShader:w.meshmatcap_vert,fragmentShader:w.meshmatcap_frag},points:{uniforms:Y([b.points,b.fog]),vertexShader:w.points_vert,fragmentShader:w.points_frag},dashed:{uniforms:Y([b.common,b.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:w.linedashed_vert,fragmentShader:w.linedashed_frag},depth:{uniforms:Y([b.common,b.displacementmap]),vertexShader:w.depth_vert,fragmentShader:w.depth_frag},normal:{uniforms:Y([b.common,b.bumpmap,b.normalmap,b.displacementmap,{opacity:{value:1}}]),vertexShader:w.meshnormal_vert,fragmentShader:w.meshnormal_frag},sprite:{uniforms:Y([b.sprite,b.fog]),vertexShader:w.sprite_vert,fragmentShader:w.sprite_frag},background:{uniforms:{uvTransform:{value:new C},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:w.background_vert,fragmentShader:w.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new C}},vertexShader:w.backgroundCube_vert,fragmentShader:w.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:w.cube_vert,fragmentShader:w.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:w.equirect_vert,fragmentShader:w.equirect_frag},distanceRGBA:{uniforms:Y([b.common,b.displacementmap,{referencePosition:{value:new x},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:w.distanceRGBA_vert,fragmentShader:w.distanceRGBA_frag},shadow:{uniforms:Y([b.lights,b.fog,{color:{value:new L(0)},opacity:{value:1}}]),vertexShader:w.shadow_vert,fragmentShader:w.shadow_frag}};Cr.physical={uniforms:Y([Cr.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new C},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new C},clearcoatNormalScale:{value:new O(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new C},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new C},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new C},sheen:{value:0},sheenColor:{value:new L(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new C},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new C},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new C},transmissionSamplerSize:{value:new O},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new C},attenuationDistance:{value:0},attenuationColor:{value:new L(0)},specularColor:{value:new L(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new C},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new C},anisotropyVector:{value:new O},anisotropyMap:{value:null},anisotropyMapTransform:{value:new C}}]),vertexShader:w.meshphysical_vert,fragmentShader:w.meshphysical_frag};var sn=class extends fe{constructor(t=-1,e=1,n=1,i=-1,r=.1,s=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=s,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,s){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-t,s=n+t,o=i+e,a=i-e;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,s=r+l*this.view.width,o-=h*this.view.offsetY,a=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,s,o,a,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},he=4,wr=[.125,.215,.35,.446,.526,.582],Vt=20,qn=new sn,Tr=new L,Wn=null,Qn=0,Yn=0,Xn=!1,zt=(1+Math.sqrt(5))/2,le=1/zt,Dr=[new x(-zt,le,0),new x(zt,le,0),new x(-le,0,zt),new x(le,0,zt),new x(0,zt,-le),new x(0,zt,le),new x(-1,1,-1),new x(1,1,-1),new x(-1,1,1),new x(1,1,1)],on=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){Wn=this._renderer.getRenderTarget(),Qn=this._renderer.getActiveCubeFace(),Yn=this._renderer.getActiveMipmapLevel(),Xn=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,i,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=kr(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Lr(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Wn,Qn,Yn),this._renderer.xr.enabled=Xn,t.scissorTest=!1,Xe(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ji||t.mapping===$i?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Wn=this._renderer.getRenderTarget(),Qn=this._renderer.getActiveCubeFace(),Yn=this._renderer.getActiveMipmapLevel(),Xn=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:bt,minFilter:bt,generateMipmaps:!1,type:Ls,format:dn,colorSpace:Pe,depthBuffer:!1},i=Br(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Br(t,e,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Lc(r)),this._blurMaterial=kc(r,t,e)}return i}_compileMaterial(t){let e=new dt(this._lodPlanes[0],t);this._renderer.compile(e,qn)}_sceneToCubeUV(t,e,n,i){let o=new ai(90,1,e,n),a=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Tr),h.toneMapping=Ts,h.autoClear=!1;let f=new de({name:"PMREM.Background",side:Fr,depthWrite:!1,depthTest:!1}),p=new dt(new oi,f),m=!1,v=t.background;v?v.isColor&&(f.color.copy(v),t.background=null,m=!0):(f.color.copy(Tr),m=!0);for(let g=0;g<6;g++){let _=g%3;_===0?(o.up.set(0,a[g],0),o.lookAt(l[g],0,0)):_===1?(o.up.set(0,0,a[g]),o.lookAt(0,l[g],0)):(o.up.set(0,a[g],0),o.lookAt(0,0,l[g]));let A=this._cubeSize;Xe(i,_*A,g>2?A:0,A,A),h.setRenderTarget(i),m&&h.render(p,o),h.render(t,o)}p.geometry.dispose(),p.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=v}_textureToCubeUV(t,e){let n=this._renderer,i=t.mapping===Ji||t.mapping===$i;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=kr()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Lr());let r=i?this._cubemapMaterial:this._equirectMaterial,s=new dt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;let a=this._cubeSize;Xe(e,0,0,3*a,2*a),n.setRenderTarget(e),n.render(s,qn)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let i=this._lodPlanes.length;for(let r=1;r<i;r++){let s=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Dr[(i-r-1)%Dr.length];this._blur(t,r-1,r,s,o)}e.autoClear=n}_blur(t,e,n,i,r){let s=this._pingPongRenderTarget;this._halfBlur(t,s,e,n,i,"latitudinal",r),this._halfBlur(s,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,s,o){let a=this._renderer,l=this._blurMaterial;s!=="latitudinal"&&s!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new dt(this._lodPlanes[i],l),d=l.uniforms,f=this._sizeLods[n]-1,p=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*Vt-1),m=r/p,v=isFinite(r)?1+Math.floor(h*m):Vt;v>Vt&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${v} samples when the maximum is set to ${Vt}`);let g=[],_=0;for(let E=0;E<Vt;++E){let M=E/m,T=Math.exp(-M*M/2);g.push(T),E===0?_+=T:E<v&&(_+=2*T)}for(let E=0;E<g.length;E++)g[E]=g[E]/_;d.envMap.value=t.texture,d.samples.value=v,d.weights.value=g,d.latitudinal.value=s==="latitudinal",o&&(d.poleAxis.value=o);let{_lodMax:A}=this;d.dTheta.value=p,d.mipInt.value=A-n;let y=this._sizeLods[i],U=3*y*(i>A-he?i-A+he:0),P=4*(this._cubeSize-y);Xe(e,U,P,3*y,2*y),a.setRenderTarget(e),a.render(u,qn)}};function Lc(c){let t=[],e=[],n=[],i=c,r=c-he+1+wr.length;for(let s=0;s<r;s++){let o=Math.pow(2,i);e.push(o);let a=1/o;s>c-he?a=wr[s-c+he-1]:s===0&&(a=0),n.push(a);let l=1/(o-2),h=-l,u=1+l,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,p=6,m=3,v=2,g=1,_=new Float32Array(m*p*f),A=new Float32Array(v*p*f),y=new Float32Array(g*p*f);for(let P=0;P<f;P++){let E=P%3*2/3-1,M=P>2?0:-1,T=[E,M,0,E+2/3,M,0,E+2/3,M+1,0,E,M,0,E+2/3,M+1,0,E,M+1,0];_.set(T,m*p*P),A.set(d,v*p*P);let B=[P,P,P,P,P,P];y.set(B,g*p*P)}let U=new Lt;U.setAttribute("position",new X(_,m)),U.setAttribute("uv",new X(A,v)),U.setAttribute("faceIndex",new X(y,g)),t.push(U),i>he&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Br(c,t,e){let n=new be(c,t,e);return n.texture.mapping=Ds,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Xe(c,t,e,n,i){c.viewport.set(t,e,n,i),c.scissor.set(t,e,n,i)}function kc(c,t,e){let n=new Float32Array(Vt),i=new x(0,1,0);return new pt({name:"SphericalGaussianBlur",defines:{n:Vt,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${c}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Mi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Me,depthTest:!1,depthWrite:!1})}function Lr(){return new pt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Mi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Me,depthTest:!1,depthWrite:!1})}function kr(){return new pt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Mi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Me,depthTest:!1,depthWrite:!1})}function Mi(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var fl=new Float32Array(16),pl=new Float32Array(9),ml=new Float32Array(4);var vl={[Wi]:Qi,[Yi]:ji,[Xi]:Zi,[Ze]:Ki,[Qi]:Wi,[ji]:Yi,[Zi]:Xi,[Ki]:Ze};var an=class extends nt{constructor(){super(),this.isGroup=!0,this.type="Group"}};var cn=class extends nt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Qt,this.environmentIntensity=1,this.environmentRotation=new Qt,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}};var ln=class extends Dt{constructor(t=null,e=1,n=1,i,r,s,o,a,l=Je,h=Je,u,d){super(null,s,o,a,l,h,i,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};function Ke(c,t,e){return!c||!e&&c.constructor===t?c:typeof t.BYTES_PER_ELEMENT=="number"?new t(c):Array.prototype.slice.call(c)}function Rc(c){return ArrayBuffer.isView(c)&&!(c instanceof DataView)}var pe=class{constructor(t,e,n,i){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,i=e[n],r=e[n-1];n:{t:{let s;e:{i:if(!(t<i)){for(let o=n+2;;){if(i===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=e[++n],t<i)break t}s=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let a=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(i=r,r=e[--n-1],t>=r)break t}s=n,n=0;break e}break n}for(;n<s;){let o=n+s>>>1;t<e[o]?s=o:n=o+1}if(i=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,t,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=t*i;for(let s=0;s!==i;++s)e[s]=n[r+s];return e}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},li=class extends pe{constructor(t,e,n,i){super(t,e,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:nr,endingEnd:nr}}intervalChanged_(t,e,n){let i=this.parameterPositions,r=t-2,s=t+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case ir:r=t,o=2*e-n;break;case rr:r=i.length-2,o=e+i[r]-i[r+1];break;default:r=t,o=n}if(a===void 0)switch(this.getSettings_().endingEnd){case ir:s=t,a=2*n-e;break;case rr:s=1,a=n+i[1]-i[0];break;default:s=t-1,a=e}let l=(n-e)*.5,h=this.valueSize;this._weightPrev=l/(e-o),this._weightNext=l/(a-n),this._offsetPrev=r*h,this._offsetNext=s*h}interpolate_(t,e,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=t*o,l=a-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-e)/(i-e),m=p*p,v=m*p,g=-d*v+2*d*m-d*p,_=(1+d)*v+(-1.5-2*d)*m+(-.5+d)*p+1,A=(-1-f)*v+(1.5+f)*m+.5*p,y=f*v-f*m;for(let U=0;U!==o;++U)r[U]=g*s[h+U]+_*s[l+U]+A*s[a+U]+y*s[u+U];return r}},hi=class extends pe{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=t*o,l=a-o,h=(n-e)/(i-e),u=1-h;for(let d=0;d!==o;++d)r[d]=s[l+d]*u+s[a+d]*h;return r}},ui=class extends pe{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t){return this.copySampleValue_(t-1)}},ht=class{constructor(t,e,n,i){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Ke(e,this.TimeBufferType),this.values=Ke(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:Ke(t.times,Array),values:Ke(t.values,Array)};let i=t.getInterpolation();i!==t.DefaultInterpolation&&(n.interpolation=i)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new ui(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new hi(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new li(this.times,this.values,this.getValueSize(),t)}setInterpolation(t){let e;switch(t){case $e:e=this.InterpolantFactoryMethodDiscrete;break;case Zn:e=this.InterpolantFactoryMethodLinear;break;case Un:e=this.InterpolantFactoryMethodSmooth;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return $e;case this.InterpolantFactoryMethodLinear:return Zn;case this.InterpolantFactoryMethodSmooth:return Un}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,i=e.length;n!==i;++n)e[n]*=t}return this}trim(t,e){let n=this.times,i=n.length,r=0,s=i-1;for(;r!==i&&n[r]<t;)++r;for(;s!==-1&&n[s]>e;)--s;if(++s,r!==0||s!==i){r>=s&&(s=Math.max(s,1),r=s-1);let o=this.getValueSize();this.times=n.slice(r,s),this.values=this.values.slice(r*o,s*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,i=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),t=!1);let s=null;for(let o=0;o!==r;o++){let a=n[o];if(typeof a=="number"&&isNaN(a)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,a),t=!1;break}if(s!==null&&s>a){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,a,s),t=!1;break}s=a}if(i!==void 0&&Rc(i))for(let o=0,a=i.length;o!==a;++o){let l=i[o];if(isNaN(l)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,l),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Un,r=t.length-1,s=1;for(let o=1;o<r;++o){let a=!1,l=t[o],h=t[o+1];if(l!==h&&(o!==1||l!==t[0]))if(i)a=!0;else{let u=o*n,d=u-n,f=u+n;for(let p=0;p!==n;++p){let m=e[u+p];if(m!==e[d+p]||m!==e[f+p]){a=!0;break}}}if(a){if(o!==s){t[s]=t[o];let u=o*n,d=s*n;for(let f=0;f!==n;++f)e[d+f]=e[u+f]}++s}}if(r>0){t[s]=t[r];for(let o=r*n,a=s*n,l=0;l!==n;++l)e[a+l]=e[o+l];++s}return s!==t.length?(this.times=t.slice(0,s),this.values=e.slice(0,s*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,i=new n(this.name,t,e);return i.createInterpolant=this.createInterpolant,i}};ht.prototype.TimeBufferType=Float32Array;ht.prototype.ValueBufferType=Float32Array;ht.prototype.DefaultInterpolation=Zn;var Yt=class extends ht{constructor(t,e,n){super(t,e,n)}};Yt.prototype.ValueTypeName="bool";Yt.prototype.ValueBufferType=Array;Yt.prototype.DefaultInterpolation=$e;Yt.prototype.InterpolantFactoryMethodLinear=void 0;Yt.prototype.InterpolantFactoryMethodSmooth=void 0;var di=class extends ht{};di.prototype.ValueTypeName="color";var fi=class extends ht{};fi.prototype.ValueTypeName="number";var pi=class extends pe{constructor(t,e,n,i){super(t,e,n,i)}interpolate_(t,e,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(n-e)/(i-e),l=t*o;for(let h=l+o;l!==h;l+=4)Bt.slerpFlat(r,0,s,l-o,s,l,a);return r}},hn=class extends ht{InterpolantFactoryMethodLinear(t){return new pi(this.times,this.values,this.getValueSize(),t)}};hn.prototype.ValueTypeName="quaternion";hn.prototype.InterpolantFactoryMethodSmooth=void 0;var Xt=class extends ht{constructor(t,e,n){super(t,e,n)}};Xt.prototype.ValueTypeName="string";Xt.prototype.ValueBufferType=Array;Xt.prototype.DefaultInterpolation=$e;Xt.prototype.InterpolantFactoryMethodLinear=void 0;Xt.prototype.InterpolantFactoryMethodSmooth=void 0;var mi=class extends ht{};mi.prototype.ValueTypeName="vector";var vi=class{constructor(t,e,n){let i=this,r=!1,s=0,o=0,a,l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(h){o++,r===!1&&i.onStart!==void 0&&i.onStart(h,s,o),r=!0},this.itemEnd=function(h){s++,i.onProgress!==void 0&&i.onProgress(h,s,o),s===o&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return a?a(h):h},this.setURLModifier=function(h){return a=h,this},this.addHandler=function(h,u){return l.push(h,u),this},this.removeHandler=function(h){let u=l.indexOf(h);return u!==-1&&l.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=l.length;u<d;u+=2){let f=l[u],p=l[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return p}return null}}},Ic=new vi,gi=class{constructor(t){this.manager=t!==void 0?t:Ic,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){let n=this;return new Promise(function(i,r){n.load(t,i,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}};gi.DEFAULT_MATERIAL_NAME="__DEFAULT";var xi=class extends nt{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new L(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}};var Kn=new G,Rr=new x,Ir=new x,Ai=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new O(512,512),this.map=null,this.mapPass=null,this.matrix=new G,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ci,this._frameExtents=new O(1,1),this._viewportCount=1,this._viewports=[new ft(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;Rr.setFromMatrixPosition(t.matrixWorld),e.position.copy(Rr),Ir.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Ir),e.updateMatrixWorld(),Kn.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Kn),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Kn)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}};var yi=class extends Ai{constructor(){super(new sn(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},me=class extends xi{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(nt.DEFAULT_UP),this.updateMatrix(),this.target=new nt,this.shadow=new yi}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}};var Pi="\\[\\]\\.:\\/",Nc=new RegExp("["+Pi+"]","g"),Si="[^"+Pi+"]",Fc="[^"+Pi.replace("\\.","")+"]",Oc=/((?:WC+[\/:])*)/.source.replace("WC",Si),zc=/(WCOD+)?/.source.replace("WCOD",Fc),Hc=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Si),Vc=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Si),Gc=new RegExp("^"+Oc+zc+Hc+Vc+"$"),qc=["material","materials","bones","map"],Ui=class{constructor(t,e,n){let i=n||k.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,i)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},k=class c{constructor(t,e,n){this.path=e,this.parsedPath=n||c.parseTrackName(e),this.node=c.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new c.Composite(t,e,n):new c(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Nc,"")}static parseTrackName(t){let e=Gc.exec(t);if(e===null)throw new Error("PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);qc.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let s=0;s<r.length;s++){let o=r[s];if(o.name===e||o.uuid===e)return o;let a=n(o.children);if(a)return a}return null},i=n(t.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)t[e++]=n[i]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,i=e.propertyName,r=e.propertyIndex;if(t||(t=c.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=e.objectIndex;switch(n){case"materials":if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===l){l=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(l!==void 0){if(t[l]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[l]}}let s=t[i];if(s===void 0){let l=e.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:t.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!t.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else s.fromArray!==void 0&&s.toArray!==void 0?(a=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(a=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};k.Composite=Ui;k.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};k.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};k.prototype.GetterByBindingType=[k.prototype._getValue_direct,k.prototype._getValue_array,k.prototype._getValue_arrayElement,k.prototype._getValue_toArray];k.prototype.SetterByBindingTypeAndVersioning=[[k.prototype._setValue_direct,k.prototype._setValue_direct_setNeedsUpdate,k.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[k.prototype._setValue_array,k.prototype._setValue_array_setNeedsUpdate,k.prototype._setValue_array_setMatrixWorldNeedsUpdate],[k.prototype._setValue_arrayElement,k.prototype._setValue_arrayElement_setNeedsUpdate,k.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[k.prototype._setValue_fromArray,k.prototype._setValue_fromArray_setNeedsUpdate,k.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var gl=new Float32Array(1);typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"170"}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="170");function Xr(c,t,e){let n=new cn,i=new fe,r=new rn(2,2),s=new be(128,128,{depthBuffer:!1,stencilBuffer:!1}),o={sourceMap:{value:e[0]},packedMap:{value:t},layer:{value:0},level:{value:0},packedMode:{value:!1}},a=new pt({uniforms:o,glslVersion:Wr,depthTest:!1,depthWrite:!1,vertexShader:"out vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:"precision highp sampler2DArray;uniform sampler2D sourceMap;uniform sampler2DArray packedMap;uniform float layer,level;uniform bool packedMode;in vec2 q;out vec4 result;void main(){vec3 a=textureLod(sourceMap,q,level).rgb;vec3 b=textureLod(packedMap,vec3(q,layer),level).rgb;result=vec4(packedMode?b:a,1.);}"});n.add(new dt(r,a));let l=c.getRenderTarget(),h=c.getViewport(new ft),u=[],d=new Uint8Array(16384*4),f=new Uint8Array(d.length);try{c.setRenderTarget(s);for(let p=0;p<3;p++)for(let m of[0,2.25,5]){o.sourceMap.value=e[p],o.layer.value=p,o.level.value=m,o.packedMode.value=!1,c.render(n,i),c.readRenderTargetPixels(s,0,0,128,128,d),o.packedMode.value=!0,c.render(n,i),c.readRenderTargetPixels(s,0,0,128,128,f);let v=0,g=0;for(let _=0;_<d.length;_++){let A=Math.abs(d[_]-f[_]);v=Math.max(v,A),g+=A>0?1:0}u.push({layer:p,lod:m,maxByteDelta:v,changedChannels:g})}}finally{c.setRenderTarget(l),c.setViewport(h),s.dispose(),r.dispose(),a.dispose()}return{method:"actual GPU textureLod, sRGB decode, 128x128 full RGBA per case",cases:u,passed:u.every(p=>p.maxByteDelta<=1),comparisonTolerance:"at most 1/255 output channel",sourceResized:!1}}var jr=["6cf688756e0867bcae6ce911b8a6a68e0fad0113998087506e41ca6cc642ba70","ea78bf4b3bae42e463d6f809d7d02321ad768da5e8d16fba034d6067e9fb653e","04112d02ad7df944a083cc8964efd318f9a3a285853878b8b1ce6e30bf933207"],Zr=["72e92b530fb910976e22d02ebf0e6630e2ff75bdde757bf588b2b0f92f8b8d06","86f67a61679bf3438de0cc152cca4b3553cba41daceac6810e99d62796c552fd","c9dc71bd634accc720846e0389fb4fbff73a6a129c339771f3b5fcbb07b2adc5"],Kr=async c=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",c)),t=>t.toString(16).padStart(2,"0")).join(""),Wc=(c,t,e)=>{let n=c+t-e,i=Math.abs(n-c),r=Math.abs(n-t),s=Math.abs(n-e);return i<=r&&i<=s?c:r<=s?t:e};async function Qc(c,t){if(!c.startsWith("data:image/png;base64,"))throw Error("Expected embedded pinned eye PNG");let e=atob(c.slice(c.indexOf(",")+1)),n=Uint8Array.from(e,f=>f.charCodeAt(0));if(await Kr(n)!==jr[t])throw Error("Eye source PNG hash changed");let i=new DataView(n.buffer);if(i.getUint32(0)!==2303741511||i.getUint32(4)!==218765834)throw Error("Bad PNG signature");let r=0,s=!1,o=[];for(let f=8;f+12<=n.length;){let p=i.getUint32(f),m=String.fromCharCode(...n.subarray(f+4,f+8)),v=f+8,g=v+p;if(g+4>n.length)throw Error("Truncated PNG");if(m==="IHDR"){let _=n[v+9];if(p!==13||i.getUint32(v)!==1024||i.getUint32(v+4)!==1024||n[v+8]!==8||![2,6].includes(_)||n[v+10]||n[v+11]||n[v+12])throw Error("Unsupported pinned PNG format");r=_===6?4:3}else if(m==="IDAT")o.push(n.subarray(v,g));else if(m==="IEND"){s=!0;break}f=g+4}if(!s||!r||!o.length)throw Error("Incomplete eye PNG");let a=new Blob(o).stream().pipeThrough(new DecompressionStream("deflate")),l=new Uint8Array(await new Response(a).arrayBuffer()),h=1024*r;if(l.length!==(h+1)*1024)throw Error("Invalid PNG inflation length");let u=new Uint8Array(h*1024);for(let f=0;f<1024;f++){let p=f*h,m=f*(h+1),v=l[m];if(v>4)throw Error("Invalid PNG row filter");for(let g=0;g<h;g++){let _=g>=r?u[p+g-r]:0,A=f?u[p-h+g]:0,y=f&&g>=r?u[p-h+g-r]:0,U=v===0?0:v===1?_:v===2?A:v===3?Math.floor((_+A)/2):Wc(_,A,y);u[p+g]=l[m+1+g]+U&255}}let d=new Uint8Array(1024*1024*4);if(r===4)d.set(u);else for(let f=0;f<1024*1024;f++)d.set(u.subarray(f*3,f*3+3),f*4),d[f*4+3]=255;if(await Kr(d)!==Zr[t])throw Error("Decoded eye pixels differ from independent source proof");return d}async function Jr(c){if(c.length!==3)throw Error("Exactly three eye colour textures required");let t=c[0].image.width,e=c[0].image.height;for(let s of c)if(s.image.width!==t||s.image.height!==e||s.colorSpace!==j||s.flipY!==!1||s.wrapS!==yt||s.wrapT!==yt||s.minFilter!==un||s.magFilter!==bt)throw Error("Eye source sampling contract changed");let n=new Uint8Array(t*e*4*3);for(let s=0;s<3;s++)n.set(await Qc(c[s].image.src,s),s*t*e*4);let i=new en(n,t,e,3);i.colorSpace=j,i.flipY=!1,i.wrapS=i.wrapT=yt,i.generateMipmaps=!0,i.minFilter=un,i.magFilter=bt,i.needsUpdate=!0;let r={version:"EYE-COLOR-SAMPLER-PACK-2",sources:3,layers:3,width:t,height:e,colorSpace:"sRGB",vesselDataSeparate:!0,sourceResized:!1,geometryChanged:!1,baseBytes:n.byteLength,savedFragmentSamplers:2,allPixelsCopied:!0,transparentTexelRGBPreserved:!0,sourceSHA256:jr,decodedRGBASHA256:Zr};return{texture:i,source:c,report:r,checkSampling:s=>Xr(s,i,c),dispose(){i.dispose()}}}var kt={schema:"kaopu.bioskin-lut/1",width:33,height:17,colorSpace:"linear-sRGB",data:[.8429230451583862,.5508963465690613,.4206942915916443,.8366857767105103,.5444982647895813,.412700355052948,.8194446563720703,.5270743370056152,.3912654221057892,.7943639159202576,.5023607611656189,.36177247762680054,.7643264532089233,.47363385558128357,.3289714753627777,.7311519980430603,.4428795576095581,.2957612872123718,.695755660533905,.4111315906047821,.263595312833786,.6585158705711365,.3789752125740051,.23314693570137024,.6195652484893799,.3468375504016876,.2047315537929535,.5789862275123596,.315076619386673,.17849025130271912,.5369403958320618,.28399142622947693,.15446510910987854,.4937663674354553,.2538425922393799,.13264745473861694,.45004603266716003,.22489109635353088,.11301072686910629,.4065762758255005,.19740906357765198,.09551013261079788,.36422109603881836,.17164210975170135,.0800681784749031,.3237544000148773,.1477876901626587,.06658509373664856,.28580862283706665,.12603221833705902,.05497581139206886,.25083956122398376,.10656332969665527,.04517843574285507,.2190767228603363,.08952109515666962,.03711210563778877,.19064681231975555,.0749787986278534,.03063642419874668,.1657513678073883,.0629524439573288,.02555159106850624,.14449143409729004,.05330895632505417,.02161591127514839,.12657871842384338,.04569438844919205,.01857162080705166,.11148378252983093,.03966665267944336,.01619003526866436,.09873314201831818,.03485642746090889,.01429976150393486,.08795775473117828,.030992655083537102,.01277998648583889,.07881070673465729,.027861079201102257,.011541586369276047,.07094137370586395,.02528034709393978,.010514818131923676,.06402310729026794,.023099703714251518,.009643882513046265,.0577775202691555,.02119935303926468,.008884266018867493,.05200463533401489,.01949221082031727,.008202780038118362,.046652160584926605,.017935341224074364,.007582177873700857,.04184690862894058,.016535991802811623,.007023891434073448,.8126588463783264,.4994708299636841,.39338207244873047,.8065107464790344,.4936523139476776,.3858816623687744,.7895357608795166,.4778704345226288,.3658047318458557,.7648685574531555,.4555892050266266,.3382333815097809,.7353464365005493,.42975056171417236,.30760252475738525,.7027804851531982,.402090460062027,.2766038477420807,.6681478023529053,.37352392077445984,.24659880995750427,.6319453716278076,.3446210026741028,.21823856234550476,.5944696068763733,.3158581256866455,.19185446202754974,.555993378162384,.2876770794391632,.1676233410835266,.5168602466583252,.26045650243759155,.14562053978443146,.4775004982948303,.23447756469249725,.12584489583969116,.4383932650089264,.20991277694702148,.10823750495910645,.40000489354133606,.1868344396352768,.0926896259188652,.362749308347702,.1652432680130005,.07904620468616486,.3269791305065155,.14511103928089142,.0671173483133316,.29298532009124756,.1264224648475647,.056704431772232056,.26098984479904175,.10920125246047974,.0476376935839653,.2311617136001587,.09352948516607285,.03981107473373413,.20365703105926514,.079537533223629,.03317883238196373,.17859555780887604,.06732460856437683,.027694156393408775,.15601114928722382,.05687776207923889,.02324998751282692,.13592450320720673,.048103515058755875,.01969042792916298,.11842285841703415,.04089768975973129,.016859842464327812,.10350023210048676,.03511079028248787,.014619234949350357,.0908963605761528,.030504437163472176,.012840394861996174,.08022197335958481,.026814773678779602,.01141256932169199,.07114366441965103,.023828960955142975,.01025119237601757,.06340846419334412,.021393008530139923,.009294489398598671,.05678102746605873,.0193845946341753,.008494652807712555,.051013343036174774,.017695922404527664,.0078118122182786465,.04586685448884964,.016233885660767555,.0072126323357224464,.041169870644807816,.014929918572306633,.0066727809607982635,.7944356203079224,.470761239528656,.37812232971191406,.7883654236793518,.4652930796146393,.3709009289741516,.7716023325920105,.450467050075531,.35157591104507446,.747227668762207,.42953458428382874,.3250425159931183,.7180269956588745,.40523943305015564,.2955619990825653,.6857948303222656,.37919652462005615,.26572126150131226,.6515259742736816,.3522668778896332,.2368357628583908,.6157587766647339,.325003057718277,.20954112708568573,.5788360834121704,.2978824973106384,.18416832387447357,.5410819053649902,.2713589668273926,.16090381145477295,.5028961896896362,.24583347141742706,.13983836770057678,.46477627754211426,.22161564230918884,.12098627537488937,.4272696375846863,.1989084780216217,.10430000722408295,.39088916778564453,.17780303955078125,.08967561274766922,.35602912306785583,.15828438103199005,.07695230841636658,.3229198753833771,.14025506377220154,.06592004001140594,.2916478216648102,.12358343601226807,.056343987584114075,.26222413778305054,.1081639900803566,.048001728951931,.2346540093421936,.09396444261074066,.040721967816352844,.20896755158901215,.0810350850224495,.03440595418214798,.185209721326828,.06946760416030884,.02901086024940014,.16340790688991547,.05931825935840607,.02449674718081951,.14354246854782104,.05055021867156029,.020781541243195534,.12557917833328247,.04305540397763252,.017746340483427048,.10956020653247833,.03673240542411804,.015273689292371273,.09559565782546997,.03151174262166023,.013270141556859016,.08367863297462463,.027292009443044662,.011656251735985279,.0735863521695137,.023904548957943916,.010354342870414257,.06500662118196487,.021164603531360626,.009293723851442337,.0576770082116127,.01892392709851265,.00841833371669054,.051394023001194,.017074132338166237,.007685674354434013,.04596215486526489,.015526879578828812,.007061493583023548,.041177116334438324,.014203141443431377,.006516637280583382,.7810753583908081,.4507499635219574,.36742401123046875,.775068998336792,.4455184042453766,.36039289832115173,.7584760785102844,.4313329756259918,.34157848358154297,.7343307733535767,.4112982451915741,.3157477378845215,.705375611782074,.38803088665008545,.2870468199253082,.6733909249305725,.3630724251270294,.25799354910850525,.6393840312957764,.33725056052207947,.22987249493598938,.603919267654419,.3111025393009186,.203307643532753,.567365825176239,.2850974202156067,.17862631380558014,.5300689339637756,.25968578457832336,.15601737797260284,.4924478232860565,.23526889085769653,.1355779469013214,.4550195336341858,.21216267347335815,.1173286959528923,.41835737228393555,.19058161973953247,.1012275442481041,.3830077648162842,.17063455283641815,.08717570453882217,.3493986427783966,.15232564508914948,.07501763105392456,.3177746534347534,.13556461036205292,.06454569101333618,.28818821907043457,.12019699811935425,.055519066751003265,.26054972410202026,.10605417191982269,.04769522696733475,.2347196489572525,.09301139414310455,.04086698964238167,.2105993777513504,.08103228360414505,.034893736243247986,.18816427886486053,.0701666995882988,.029707200825214386,.16742324829101562,.06048830971121788,.02527780272066593,.14834927022457123,.05201074481010437,.02156144753098488,.1308652013540268,.044657543301582336,.018475309014320374,.11490052193403244,.038306526839733124,.015916218981146812,.10047459602355957,.032860346138477325,.013792254962027073,.08771099895238876,.028274545446038246,.012037552893161774,.07669717073440552,.02450704388320446,.010601727291941643,.06733281165361404,.021458199247717857,.00943286344408989,.05937137454748154,.018986094743013382,.008476454764604568,.0525614358484745,.01695915497839451,.0076842946000397205,.04670604690909386,.015278425998985767,.007018435746431351,.04163358733057976,.013867590576410294,.006448728032410145,.7704086303710938,.43538618087768555,.3591778874397278,.7644563913345337,.4303286373615265,.3522890508174896,.7480069994926453,.4166131615638733,.33385610580444336,.7240524888038635,.39723843336105347,.30855125188827515,.6952999234199524,.37473171949386597,.2804361879825592,.6635172367095947,.3505842089653015,.25197792053222656,.6297227144241333,.32559964060783386,.22443802654743195,.5945010781288147,.3003019392490387,.1984308958053589,.5582412481307983,.27515020966529846,.17427995800971985,.5213017463684082,.2505866587162018,.1521739363670349,.4841083884239197,.22700762748718262,.13221222162246704,.4471821188926697,.20472663640975952,.11441805213689804,.41110098361968994,.18396013975143433,.0987510085105896,.37642231583595276,.16482479870319366,.08511430025100708,.34359320998191833,.1473385989665985,.07335598766803741,.31288307905197144,.13142655789852142,.06327371299266815,.2843613028526306,.1169418916106224,.05463036894798279,.25792622566223145,.10370306670665741,.04718026518821716,.23337748646736145,.09154152870178223,.04070054367184639,.21051202714443207,.08035137504339218,.03502209484577179,.1892046332359314,.07011891901493073,.030047956854104996,.1694222390651703,.06090070307254791,.025741027668118477,.15115422010421753,.052745599299669266,.02207735925912857,.13433587551116943,.0456235408782959,.019002780318260193,.11885258555412292,.039426181465387344,.016430428251624107,.10461632907390594,.03402670845389366,.014268663711845875,.09164516627788544,.02934081479907036,.012446054257452488,.08006998151540756,.02534322999417782,.010917360894382,.07001049071550369,.02202041819691658,.009650716558098793,.06142386421561241,.019310107454657555,.008610527962446213,.054112620651721954,.0171024389564991,.007754456251859665,.04784806817770004,.015284992754459381,.007041777018457651,.042442433536052704,.013769689947366714,.00643903249874711,.761469304561615,.4229300916194916,.3524838089942932,.7555645108222961,.4180077612400055,.3457072973251343,.7392398715019226,.4046585261821747,.3275756537914276,.715450644493103,.38579991459846497,.30268698930740356,.6868724822998047,.3638925552368164,.275037944316864,.6552631855010986,.34039023518562317,.24705560505390167,.6216501593589783,.3160780072212219,.21998330950737,.5866366624832153,.29146823287010193,.1944277137517929,.5506286025047302,.267009437084198,.1707080900669098,.5139934420585632,.24313528835773468,.14901195466518402,.4771599769592285,.22023461759090424,.12943923473358154,.44064605236053467,.19861577451229095,.11201384663581848,.40502575039863586,.1784931868314743,.09669503569602966,.37085527181625366,.15998594462871552,.08338591456413269,.3385884165763855,.1431199610233307,.07193653285503387,.3085099756717682,.12783224880695343,.062148772180080414,.2807098627090454,.11398766189813614,.053790703415870667,.25510138273239136,.10140888392925262,.04661967232823372,.23147624731063843,.08991429209709167,.04040859267115593,.20958369970321655,.07936074584722519,.03497284650802612,.1892167180776596,.0696801170706749,.030191892758011818,.1702686995267868,.06088811159133911,.026011990383267403,.15271218121051788,.05303791165351868,.022415149956941605,.13651391863822937,.046141061931848526,.019370796158909798,.12157563120126724,.040125772356987,.016812171787023544,.10776413977146149,.034865811467170715,.014652341604232788,.09499511867761612,.03024301491677761,.012813114561140537,.0833015963435173,.026193223893642426,.011241449043154716,.07282513380050659,.022709500044584274,.009908277541399002,.06369258463382721,.019793687388300896,.008793903514742851,.05587787553668022,.017401298508048058,.007872344925999641,.04920919984579086,.015442272648215294,.007109213154762983,.043478935956954956,.013820532709360123,.006469717714935541,.7537386417388916,.4124711751937866,.3468703627586365,.7478762865066528,.4076586961746216,.3401857614517212,.7316631078720093,.39460688829421997,.3223007321357727,.7080210447311401,.37616923451423645,.2977536916732788,.6795976161956787,.3547542691230774,.2704887390136719,.6481415629386902,.3317860960960388,.24290087819099426,.61468905210495,.3080349564552307,.21621830761432648,.5798602104187012,.2840026021003723,.1910409778356552,.5440755486488342,.26012805104255676,.1676846444606781,.5077111124992371,.2368355095386505,.14633487164974213,.4711957275867462,.214506134390831,.12709110975265503,.4350421726703644,.19344234466552734,.10997682064771652,.39981597661972046,.1738547682762146,.09494990110397339,.36606642603874207,.1558622568845749,.08191238343715668,.3342464566230774,.13949505984783173,.07071501016616821,.3046483099460602,.12469851225614548,.06116282939910889,.2773772180080414,.11134753376245499,.05302876606583595,.25236454606056213,.09927281737327576,.04607462137937546,.2294130027294159,.08829215914011002,.04007427394390106,.20826061069965363,.07824653387069702,.03483619540929794,.1886560469865799,.06903329491615295,.030223846435546875,.1704270839691162,.060627635568380356,.026165856048464775,.15349961817264557,.053064167499542236,.022639792412519455,.13784494996070862,.04637444019317627,.019629821181297302,.12339921295642853,.040525417774915695,.017090264707803726,.11003794521093369,.03541390970349312,.014945298433303833,.09762744605541229,.030912062153220177,.013114307075738907,.08610424399375916,.026920657604932785,.011534803546965122,.07552710920572281,.023399371653795242,.01017026137560606,.0660487711429596,.020357659086585045,.009004011750221252,.057787396013736725,.017804116010665894,.00802387110888958,.05070963874459267,.01570046879351139,.007208974566310644,.04465300589799881,.013968014158308506,.006529767997562885,.7469031810760498,.40347275137901306,.34205755591392517,.741079568862915,.39875200390815735,.3354502022266388,.7249679565429688,.38594934344291687,.3177723288536072,.7014591693878174,.36786577105522156,.29351261258125305,.6731758117675781,.3468674123287201,.26657214760780334,.6418582797050476,.3243544399738312,.23931924998760223,.6085510849952698,.30108407139778137,.21296915411949158,.5738897919654846,.2775489091873169,.18811644613742828,.5383083820343018,.2541789710521698,.16507329046726227,.5021905899047852,.23138943314552307,.14402315020561218,.4659649729728699,.20955374836921692,.1250644326210022,.43013694882392883,.18896834552288055,.10821931809186935,.39526212215423584,.16983924806118011,.09344392269849777,.3618799149990082,.15228383243083954,.080638587474823,.33043813705444336,.13633453845977783,.06965407729148865,.3012315034866333,.12194254249334335,.06029769778251648,.2743748426437378,.10899094492197037,.05234655365347862,.24981528520584106,.09731768816709518,.04556708410382271,.227370485663414,.08674473315477371,.03973599895834923,.2067835032939911,.07710760086774826,.03465965390205383,.18778571486473083,.06828440725803375,.030191782861948013,.17016218602657318,.06021985411643982,.026246218010783195,.1537901610136032,.052923526614904404,.022791242226958275,.13861919939517975,.04642795771360397,.01981714740395546,.12460353970527649,.040727030485868454,.017295755445957184,.11164724826812744,.03574727475643158,.01516607403755188,.0996134951710701,.031370703130960464,.013350941240787506,.08838409185409546,.02748142182826996,.011781584471464157,.07792814821004868,.024005237966775894,.010411744005978107,.06833536177873611,.020925866439938545,.009219017811119556,.05976445600390434,.0182648878544569,.00819556787610054,.052311308681964874,.016030773520469666,.007333045359700918,.04592117667198181,.014184446074068546,.006612673401832581,.7407588958740234,.39559003710746765,.33786436915397644,.7349709868431091,.39094802737236023,.33132317662239075,.7189531326293945,.3783591389656067,.3138223886489868,.6955674886703491,.3605803847312927,.289808988571167,.6674132347106934,.33994221687316895,.26314762234687805,.6362231969833374,.3178250789642334,.2361840307712555,.6030495166778564,.2949749529361725,.2101227194070816,.5685418844223022,.27187633514404297,.18555313348770142,.5331487655639648,.24894998967647552,.16278451681137085,.49725955724716187,.22660326957702637,.14199799299240112,.4613020420074463,.205202117562294,.12329037487506866,.4257742166519165,.18503698706626892,.10668236017227173,.3912205696105957,.1663091629743576,.09212783724069595,.3581692576408386,.14913390576839447,.0795251801609993,.3270606994628906,.13354447484016418,.06872469186782837,.29818832874298096,.11949651688337326,.05953541025519371,.27167370915412903,.10687917470932007,.05173799395561218,.24747580289840698,.09553726762533188,.04510321095585823,.22542676329612732,.0852973535656929,.0394112691283226,.2052798867225647,.07599447667598724,.034468866884708405,.18676400184631348,.06749685108661652,.030124202370643616,.16964122653007507,.05972835794091225,.02627989649772644,.15375109016895294,.05267581716179848,.022893846035003662,.1390133649110794,.04636314511299133,.019956529140472412,.12538009881973267,.04079810902476311,.017452150583267212,.11277733743190765,.035932622849941254,.015334617346525192,.10108637809753418,.031667206436395645,.013534483499825,.09017369151115417,.027885565534234047,.01198122464120388,.0799490287899971,.02449265494942665,.01062073651701212,.07042147219181061,.021441297605633736,.0094219371676445,.06171048805117607,.018736550584435463,.00837361253798008,.05397028475999832,.016406318172812462,.007473370525985956,.04726186767220497,.014452875591814518,.006713747046887875,.7351652383804321,.3885882794857025,.3341659903526306,.7294106483459473,.3840150237083435,.327682226896286,.7134804129600525,.371613085269928,.3103353679180145,.6902095675468445,.35410159826278687,.28653591871261597,.6621755361557007,.33378055691719055,.2601180374622345,.6311041712760925,.3120132088661194,.23340779542922974,.5980548858642578,.28953608870506287,.20760035514831543,.5636911392211914,.26682570576667786,.1832810938358307,.5284735560417175,.24429519474506378,.16075611114501953,.49279841780662537,.2223435491323471,.1402042806148529,.45709192752838135,.20133015513420105,.12172078341245651,.4218446910381317,.1815394163131714,.10532424598932266,.38758930563926697,.16316814720630646,.09096631407737732,.3548421859741211,.14632907509803772,.07854320108890533,.3240346312522888,.1310558021068573,.06790446490049362,.29545748233795166,.1173069179058075,.058860503137111664,.2692359983921051,.10497669130563736,.051195044070482254,.2453385293483734,.09391561150550842,.044682785868644714,.22360943257808685,.08395491540431976,.0391075536608696,.2038138508796692,.07493111491203308,.034277573227882385,.18568453192710876,.06670761853456497,.030038276687264442,.16897331178188324,.059194765985012054,.02628413587808609,.15349465608596802,.052360910922288895,.022963274270296097,.1391410082578659,.04621856287121773,.020062949508428574,.12585201859474182,.040780484676361084,.01757509633898735,.11356254667043686,.0360167920589447,.01546674408018589,.10217259079217911,.031846802681684494,.013678006827831268,.09155526757240295,.028162742033600807,.012140322476625443,.08159425854682922,.024862023070454597,.010795000940561295,.07223635911941528,.021874621510505676,.009602977894246578,.0635330006480217,.0191794466227293,.008546087890863419,.05562648922204971,.01679808273911476,.0076212165877223015,.04865134507417679,.014757705852389336,.006828228011727333,.7300204038619995,.3822999596595764,.33087247610092163,.724297285079956,.37778785824775696,.3244391977787018,.7084495425224304,.3655518889427185,.30722755193710327,.6852872371673584,.34827786684036255,.283616304397583,.6573662757873535,.32824012637138367,.2574129104614258,.6264068484306335,.3067861795425415,.23092691600322723,.5934740900993347,.2846439778804779,.20534512400627136,.5592458844184875,.26228317618370056,.18124917149543762,.5241940021514893,.24010933935642242,.15894261002540588,.4887210428714752,.21851405501365662,.1386018991470337,.45325183868408203,.1978502869606018,.12032020092010498,.41826897859573364,.17839673161506653,.10411421209573746,.3842937648296356,.16034603118896484,.08993307501077652,.3518296778202057,.14380812644958496,.07767073810100555,.32129913568496704,.1288164258003235,.06717599928379059,.29298874735832214,.11533189564943314,.0582602322101593,.2670256495475769,.10325301438570023,.05070982873439789,.24338552355766296,.09243497997522354,.04430311173200607,.221923366189003,.08271341770887375,.038827404379844666,.20241524279117584,.07392718642950058,.03409305959939957,.18460097908973694,.06593742221593857,.0299444068223238,.1682291179895401,.05864580720663071,.026270214468240738,.15309874713420868,.05200652778148651,.023010047152638435,.1390809714794159,.04602058231830597,.02014620043337345,.1261010766029358,.040701109915971756,.017674770206212997,.11409367620944977,.036030400544404984,.01557357981801033,.10297011584043503,.031943511217832565,.013792588375508785,.09261579066514969,.028343871235847473,.012267421931028366,.08291029930114746,.025129998102784157,.010937748476862907,.07376518845558167,.02221957966685295,.00975872203707695,.06516973674297333,.019568469375371933,.008704857900738716,.05721602961421013,.01717871055006981,.007768263109028339,.05005514621734619,.015081491321325302,.006950736977159977,.7252485752105713,.3766014873981476,.3279164433479309,.7195558547973633,.3721438944339752,.3215280771255493,.7037866115570068,.36005738377571106,.3044363856315613,.6807268857955933,.3429975211620331,.2809920907020569,.6529136896133423,.3232153058052063,.25497958064079285,.6220602989196777,.30204489827156067,.22869372367858887,.5892385244369507,.2802066504955292,.20331409573554993,.5551387667655945,.2581633925437927,.17941908538341522,.5202443599700928,.23631396889686584,.15730977058410645,.48496341705322266,.21504293382167816,.13716033101081848,.44971945881843567,.19469709694385529,.11906186491250992,.41498783230781555,.1755499392747879,.10302887856960297,.38127732276916504,.15779002010822296,.08900798857212067,.3490796685218811,.1415245682001114,.0768909752368927,.3188070058822632,.1267864853143692,.06652557104825974,.2907413840293884,.11353854089975357,.057724080979824066,.2650108337402344,.1016828641295433,.050275254994630814,.24159668385982513,.09107866138219833,.04396067559719086,.22036294639110565,.08156554400920868,.03857100009918213,.20109586417675018,.0729847401380539,.03391897678375244,.1835428923368454,.06519697606563568,.029848884791135788,.16745339334011078,.058098204433918,.026245569810271263,.15261757373809814,.05163176730275154,.02304142899811268,.1388908177614212,.04578820616006851,.020213017240166664,.12618567049503326,.04057861864566803,.0177579615265131,.11443296074867249,.03599362447857857,.015662677586078644,.10354882478713989,.03198086470365524,.013886513188481331,.09342798590660095,.028454268351197243,.01237038429826498,.08395533263683319,.02531726099550724,.011054325848817825,.07502857595682144,.02248341776430607,.009889977984130383,.0665941834449768,.019893253222107887,.00884585827589035,.0586869902908802,.01752740517258644,.007907913997769356,.05143159627914429,.015406065620481968,.007075647357851267,.720792293548584,.3713982105255127,.32524600625038147,.7151284217834473,.3669905364513397,.31889790296554565,.6994343400001526,.35503965616226196,.3019135892391205,.6764729619026184,.33817464113235474,.27861857414245605,.648762583732605,.318625271320343,.2527771592140198,.6180107593536377,.2977139353752136,.2266712635755539,.5852952599525452,.2761535048484802,.20147402584552765,.5513181090354919,.2544010579586029,.17776106297969818,.5165741443634033,.23284880816936493,.15583108365535736,.48147645592689514,.21187502145767212,.1358560174703598,.4464477300643921,.19182032346725464,.11792485415935516,.4119555354118347,.1729535609483719,.10204994678497314,.37849679589271545,.155459463596344,.08817528188228607,.3465513288974762,.13944238424301147,.07619045674800873,.3165208101272583,.12493475526571274,.0659421980381012,.28868257999420166,.11190079897642136,.05724341422319412,.26316455006599426,.10024542361497879,.04988516867160797,.23995254933834076,.08983179181814194,.04365190118551254,.218918576836586,.08050281554460526,.038337454199790955,.199857696890831,.07210233062505722,.033756982535123825,.18252530694007874,.06449130922555923,.02975543588399887,.16667380928993225,.05756201222538948,.026215076446533203,.15208816528320312,.05124956741929054,.023062413558363914,.13861267268657684,.04553516209125519,.02026810124516487,.12614953517913818,.04042669013142586,.017829371616244316,.11462552100419998,.035920608788728714,.015739206224679947,.10395823419094086,.03197489306330681,.013965677469968796,.09404721111059189,.028512531891465187,.012455481104552746,.08478333055973053,.02544252946972847,.011150209233164787,.07606244832277298,.022678982466459274,.00999972503632307,.06780809164047241,.02015429548919201,.008968221955001354,.0600079670548439,.01783210225403309,.008035951294004917,.05274079367518425,.015715282410383224,.007197873666882515,.7166058421134949,.36661699414253235,.32282018661499023,.7109696865081787,.36225491762161255,.31650859117507935,.6953478455543518,.3504284620285034,.299621045589447,.6724812388420105,.3337422013282776,.27646055817604065,.6448700428009033,.31440675258636475,.25077342987060547,.6142158508300781,.29373377561569214,.22483029961585999,.5816024541854858,.2724292576313019,.19979862868785858,.547743022441864,.25094491243362427,.1762513518333435,.5131428837776184,.2296668291091919,.15448535978794098,.47822147607803345,.208966925740242,.13467010855674744,.443399041891098,.18918055295944214,.11689259111881256,.40913596749305725,.17057207226753235,.10116277635097504,.37591803073883057,.1533222496509552,.08742232620716095,.3442121744155884,.1375333070755005,.07555845379829407,.3144109845161438,.1232365071773529,.06541687995195389,.28678569197654724,.11039739847183228,.05681116133928299,.26146408915519714,.09892364591360092,.049534235149621964,.23843573033809662,.08868154883384705,.04337339475750923,.21757939457893372,.07951711863279343,.03812529146671295,.1986982375383377,.0712767019867897,.0336076095700264,.18155519664287567,.06382205337285995,.029666274785995483,.16590675711631775,.05704296752810478,.02618199959397316,.1515352576971054,.0508684366941452,.023076504468917847,.138277068734169,.04527130350470543,.020314780995249748,.12602590024471283,.04025556147098541,.017892293632030487,.11470558494329453,.035821784287691116,.015806768089532852,.10423444956541061,.03193691745400429,.01403425820171833,.09451398253440857,.02853185497224331,.012527449056506157,.08543817698955536,.02552070841193199,.011230175383388996,.07690533995628357,.022819610312581062,.010091612115502357,.06882979720830917,.020358115434646606,.00907314382493496,.06116795539855957,.018088718876242638,.008150454610586166,.05395204573869705,.015997374430298805,.007313506677746773,.7126536965370178,.3621988892555237,.3206062614917755,.7070438861846924,.35787925124168396,.31432774662971497,.6914920806884766,.3461678624153137,.2975281774997711,.6687167882919312,.3296469449996948,.2744895815849304,.6412015557289124,.3105095326900482,.24894243478775024,.6106419563293457,.29005706310272217,.22314725816249847,.5781270265579224,.26898980140686035,.19826659560203552,.5443811416625977,.24775396287441254,.17487101256847382,.5099198818206787,.22672994434833527,.1532554179430008,.47516778111457825,.20628385245800018,.13358741998672485,.4405437409877777,.18674607574939728,.1159515529870987,.4065004289150238,.16837671399116516,.10035564005374908,.37351328134536743,.15135279297828674,.08673879504203796,.3420366048812866,.13577426970005035,.07498615235090256,.3124532401561737,.12167161703109741,.06494232267141342,.28502896428108215,.10901124030351639,.056421343237161636,.25989073514938354,.09770321100950241,.04921795055270195,.23703113198280334,.08761674910783768,.043122027069330215,.21633495390415192,.07860082387924194,.037932947278022766,.19761282205581665,.07050392776727676,.03347073495388031,.18063469231128693,.06318888813257217,.02958262711763382,.16516157984733582,.05654419958591461,.026148442178964615,.15097518265247345,.050493791699409485,.023086154833436012,.1379057615995407,.0450035035610199,.02035544626414776,.12584024667739868,.04007283225655556,.017949072644114494,.11470011621713638,.03570514917373657,.015867961570620537,.10440527647733688,.03187533840537071,.014095254242420197,.0948583111166954,.028521742671728134,.012589748948812485,.08595374971628189,.025562837719917297,.011298010125756264,.07759160548448563,.02291702851653099,.010169154964387417,.06968431174755096,.020513499155640602,.009162770584225655,.06217121705412865,.01829880103468895,.008251252584159374,.05504739284515381,.016245681792497635,.007420097012072802,.7089052796363831,.3580973148345947,.31857746839523315,.7033218741416931,.35381680727005005,.3123292326927185,.6878378987312317,.3422124981880188,.2956099510192871,.6651513576507568,.3258454501628876,.2726823687553406,.637729287147522,.3068923056125641,.24726280570030212,.6072614789009094,.2866453528404236,.22160287201404572,.574842095375061,.2657991647720337,.19686050713062286,.5412061214447021,.24479468166828156,.1736043095588684,.5068792104721069,.22400729358196259,.1521274745464325,.4722902178764343,.20379774272441864,.13259539008140564,.4378573000431061,.18449127674102783,.11509068310260773,.4040260314941406,.1663440465927124,.09961873292922974,.371260404586792,.14953000843524933,.08611626923084259,.34000349044799805,.13414660096168518,.074466273188591,.3106280267238617,.12022357434034348,.06451232731342316,.2833944261074066,.1077280193567276,.05606890469789505,.2584283947944641,.09657219052314758,.048932403326034546,.23572544753551483,.08662799000740051,.04289504885673523,.21517536044120789,.07774704694747925,.037758808583021164,.1965957134962082,.06977992504835129,.03334593027830124,.17976316809654236,.06259068101644516,.029505101963877678,.16444337368011475,.056066930294036865,.026115810498595238,.1504184901714325,.05012897402048111,.023093080148100853,.1375141143798828,.04473643749952316,.020391788333654404,.1256115585565567,.03988410905003548,.01800139993429184,.11463034898042679,.03557683154940605,.015924641862511635,.10449284315109253,.03179662302136421,.01415085606276989,.09510337561368942,.028489211574196815,.012644953094422817,.08635562658309937,.025577139109373093,.01135663129389286,.07814933359622955,.022980550304055214,.010235358960926533,.07039720565080643,.020629163831472397,.00923954788595438,.06303103268146515,.0184670090675354,.008339284919202328,.056020911782979965,.01645813323557377,.0075165340676903725,.705337643623352,.35427287220954895,.3167113959789276,.6997793912887573,.3500292897224426,.3104911744594574,.6843613386154175,.3385254144668579,.29384562373161316,.6617612838745117,.3223021626472473,.27101966738700867,.634429931640625,.30352160334587097,.24571694433689117,.604051947593689,.2834669351577759,.22018112242221832,.5717255473136902,.26282742619514465,.19556590914726257,.538196325302124,.24203966557979584,.17243817448616028,.5039992332458496,.22147361934185028,.1510896384716034,.4695682227611542,.20148499310016632,.13168367743492126,.4353201985359192,.1823945790529251,.11430070549249649,.40169331431388855,.16445477306842804,.09894393384456635,.36914119124412537,.14783653616905212,.08554762601852417,.3380952477455139,.13263483345508575,.07399274408817291,.3089190721511841,.11887869983911514,.06412181258201599,.28186696767807007,.10653596371412277,.05574963241815567,.2570638060569763,.09552063047885895,.04867421090602875,.23450720310211182,.08570719510316849,.04268999025225639,.21409186720848083,.07694964855909348,.0376012846827507,.19564135372638702,.06910073757171631,.03323255479335785,.17893865704536438,.062025558203458786,.02943393774330616,.16375426948070526,.055611565709114075,.026084991171956062,.1498715728521347,.049775972962379456,.023098494857549667,.1371128112077713,.04447328299283981,.020425040274858475,.12535400688648224,.039693355560302734,.018050458282232285,.11451292783021927,.03544149175286293,.015978150069713593,.10451503843069077,.03170593082904816,.014202667400240898,.09526760131120682,.028439747169613838,.01269497536122799,.08666365593671799,.02556971088051796,.011408255435526371,.07860076427459717,.02301732264459133,.010292664170265198,.07099125534296036,.020712729543447495,.009305769577622414,.06376437097787857,.018599236384034157,.008416015654802322,.056875862181186676,.016635863110423088,.007602771744132042],sourceCommit:"6cca1a76ac3f53077579c4249983ec91d855801d"};var Ci="kaopu.skin-dna/2",Kt=Object.freeze({seed:41731,melanin:.22,blood:.28,variation:.5,freckles:.08,sun:.12,age:.2,oil:.3,hydration:.55,pores:.75,poreScale:1,detail:.65}),$r=Object.freeze({flush:0,sweat:0,dryness:0}),Ce=Object.freeze([{id:"silk",name:"01 \xB7 \u7EC6\u817B\u4E2D\u6027",note:"\u7EC6\u6BDB\u5B54 \xB7 \u5C40\u90E8\u8F7B\u6CB9\u8102 \xB7 \u67D4\u548C\u8272\u7D20\u53D8\u5316",profile:{...Kt,seed:41731,melanin:.22,blood:.24,variation:.48,freckles:.035,oil:.27,pores:.65,detail:.55}},{id:"freckle",name:"02 \xB7 \u6D45\u8272\u5FAE\u7EA2",note:"\u6D45\u8272\u57FA\u5E95 \xB7 \u988A\u90E8\u5FAE\u7EA2 \xB7 \u4E0D\u5236\u9020\u96C0\u6591",profile:{...Kt,seed:86219,melanin:.08,blood:.29,variation:.68,freckles:.83,sun:.24,oil:.2,pores:.63,poreScale:.88,detail:.6}},{id:"outdoor",name:"03 \xB7 \u6696\u8272\u65E5\u6652",note:"\u8F83\u6DF1\u8272\u7D20 \xB7 \u66B4\u9732\u533A\u5DEE\u5F02 \xB7 \u5C40\u90E8\u5E72\u6DA6",profile:{...Kt,seed:27943,melanin:.39,blood:.2,variation:.83,freckles:.32,sun:.72,age:.42,oil:.35,hydration:.38,pores:1.02,poreScale:1.14,detail:.88}},{id:"deep",name:"04 \xB7 \u6DF1\u8272\u7F0E\u9762",note:"\u6DF1\u8272\u57FA\u5E95 \xB7 \u4E0D\u67D3\u9ED1\u7684\u8868\u9762\u53CD\u5149 \xB7 \u8272\u7D20\u5C42\u6B21",profile:{...Kt,seed:66107,melanin:.78,blood:.17,variation:.62,freckles:.08,sun:.12,oil:.38,hydration:.65,pores:.83,poreScale:.98,detail:.66}},{id:"mature",name:"05 \xB7 \u5E72\u71E5\u67D4\u5149",note:"\u8F83\u5E72\u8868\u9762 \xB7 \u8F83\u5BBD\u67D4\u5149 \xB7 \u4E0D\u4F2A\u9020\u8870\u8001",profile:{...Kt,seed:19463,melanin:.23,blood:.21,variation:.9,freckles:.22,sun:.36,age:.85,oil:.12,hydration:.22,pores:.92,poreScale:1.13,detail:1.08}},{id:"dewy",name:"06 \xB7 \u6DA6\u6CFD\u6DF7\u5408",note:"T\u533A\u6CB9\u8102 \xB7 \u988A\u90E8\u67D4\u5149 \xB7 \u6709\u9650\u6E7F\u6DA6\u5C42",profile:{...Kt,seed:93113,melanin:.3,blood:.3,variation:.58,freckles:.03,sun:.08,age:.23,oil:.72,hydration:.84,pores:.7,poreScale:1,detail:.48}}]),Xc={seed:[1,16777215],melanin:[0,1],blood:[0,1],variation:[0,1],freckles:[0,1],sun:[0,1],age:[0,1],oil:[0,1],hydration:[0,1],pores:[0,1.5],poreScale:[.65,1.5],detail:[0,1.5]};function ts(c,t,e){if(!c||typeof c!="object"||Array.isArray(c))throw Error("\u76AE\u80A4\u53C2\u6570\u5FC5\u987B\u4E3A\u5BF9\u8C61");let n={...t};for(let[i,r]of Object.entries(c)){if(!Object.hasOwn(e,i))throw Error("\u672A\u77E5\u76AE\u80A4\u53C2\u6570: "+i);let[s,o]=e[i];if(typeof r!="number"||!Number.isFinite(r)||r<s||r>o||i==="seed"&&!Number.isInteger(r))throw Error("\u76AE\u80A4\u53C2\u6570\u8D8A\u754C: "+i);n[i]=r}return n}var Kc=c=>ts(c,Kt,Xc),jc=c=>ts(c,$r,{flush:[0,1],sweat:[0,1],dryness:[0,1]});function pn(c){if(!c||c.schema!==Ci)throw Error("\u9700\u8981 R02 \u76AE\u80A4\u914D\u65B9\uFF1BR01 \u914D\u65B9\u8BF7\u5728\u4FDD\u7559\u7684\u65E7\u7F51\u9875\u6253\u5F00\uFF0C\u4E0D\u80FD\u9759\u9ED8\u5957\u7528\u65B0\u5149\u5B66\u89C4\u5219");if(!["fast","diffusion"].includes(c.quality))throw Error("\u76AE\u80A4\u8D28\u91CF\u6863\u65E0\u6548");if(typeof c.enabled!="boolean")throw Error("\u76AE\u80A4\u5F00\u5173\u65E0\u6548");if(typeof c.preset!="string"||c.preset.length>48)throw Error("\u76AE\u80A4\u9884\u8BBE\u6807\u8BC6\u65E0\u6548");return{schema:Ci,preset:c.preset,enabled:c.enabled,quality:c.quality,profile:Kc(c.profile),state:jc(c.state)}}function mn(c="silk"){let t=Ce.find(e=>e.id===c)||Ce[0];return pn({schema:Ci,preset:t.id,enabled:!0,quality:"fast",profile:t.profile,state:$r})}function es(c){let t=c>>>0,e=()=>(t^=t<<13,t^=t>>>17,t^=t<<5,(t>>>0)/4294967296);return[e()*91+3,e()*87+7,e()*79+11]}var Zc=`
uniform float uSDOn,uSDMel,uSDBlood,uSDVariation,uSDFreckles,uSDSun,uSDAge,uSDOil,uSDHydration,uSDPores,uSDPoreScale,uSDDetail,uSDFlush,uSDSweat,uSDDry,uSDView,uSDSeed;
uniform vec3 uSDOffset;
float sdCover=0.,sdSkin=0.,sdRough=.6,sdOil=0.,sdHeight=0.,sdPigment=0.;
float sdHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float sdNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(sdHash(i),sdHash(i+vec3(1,0,0)),f.x),mix(sdHash(i+vec3(0,1,0)),sdHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(sdHash(i+vec3(0,0,1)),sdHash(i+vec3(1,0,1)),f.x),mix(sdHash(i+vec3(0,1,1)),sdHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
// Official BioSkin fixed-property slice, sampled in LINEAR RGB.
uniform sampler2D uRFPores;uniform int uSDBioRow;
vec3 sdBio(vec2 uv){vec2 p=clamp(uv,0.,1.)*vec2(32.,16.);ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(32,16));vec2 f=fract(p);a.y+=uSDBioRow;b.y+=uSDBioRow;return mix(mix(texelFetch(uRFPores,a,0).rgb,texelFetch(uRFPores,ivec2(b.x,a.y),0).rgb,f.x),mix(texelFetch(uRFPores,ivec2(a.x,b.y),0).rgb,texelFetch(uRFPores,b,0).rgb,f.x),f.y);}
`;function ns(c){let t=c.skin.material,e=t.onBeforeCompile,n=t.customProgramCacheKey.bind(t),i={};for(let a of["On","Mel","Blood","Variation","Freckles","Sun","Age","Oil","Hydration","Pores","PoreScale","Detail","Flush","Sweat","Dry","View","Seed"])i["uSD"+a]={value:0};if(i.uSDOffset={value:[0,0,0]},kt.width!==33||kt.height!==17||kt.colorSpace!=="linear-sRGB")throw Error("BioSkin LUT contract changed");let r=new Float32Array(561*4);for(let a=0;a<561;a++)r.set(kt.data.slice(a*3,a*3+3),a*4),r[a*4+3]=1;let s={version:"SKIN-DNA-MATERIAL-R02",compiles:0,sourceGeometryChanged:!1,wholeBodyIdentity:!0,measuredOptics:!1,chromophores:"Official BioSkin spectral decoder offline LUT; fixed 2D slice, not medical concentrations",bioSkinSource:kt.sourceCommit,lutBytes:r.byteLength,sharedFloatTable:!0,extraFragmentSamplers:0,addedWrinkleGeometry:!1,noiseCreaseLayer:!1,randomPigmentIslands:!1,pores:"seeded subset and dimensions of retained area-sampled surface candidates",poreColourDots:!1,specularIndependentOfMelanin:!0};function o(a,l,h){if(a.split(l).length!==2)throw Error("Skin DNA shader anchor changed: "+l.slice(0,100));return a.replace(l,()=>h)}return t.onBeforeCompile=a=>{e(a),a.fragmentShader=o(a.fragmentShader,"uniform sampler2D uRFIndex,uRFPores;","uniform sampler2D uRFIndex;"),Object.assign(a.uniforms,i);let l=Zc+`
`+a.fragmentShader,h="diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);";l=o(l,h,h+`
 sdCover=clamp(csCover,0.,1.)*(1.-csBandVertex)*uSDOn;
 sdSkin=sdCover*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.));
 // Anatomical envelopes are retained authored masks, not measured biomaps.
 vec3 sdP=vCSRest;
 float sdExposure=clamp(.26+.49*csT+.29*rfCheek+.13*rfForehead-.35*csPalm,0.,1.);
 sdPigment=clamp(uSDMel+uSDSun*sdExposure*.04,0.,1.)*(1.-csPalm*.18);
 float sdVascular=clamp(uSDBlood+uSDVariation*(.04*rfCheek+.02*rfNose-.012*csPalm)+uSDFlush*(.05+.18*rfCheek+.06*rfNose),0.,1.);
 vec3 sdAlbedo=sdBio(vec2(sdPigment,sdVascular));
 // Preserve the specialist ear's colour ratios; make its base identity agree
 // with the surrounding head. Preserve ET19 lip structure/wetness/creases.
 sdAlbedo*=mix(vec3(1.),vec3(1.03,.96,.97),clamp(eaM,0.,1.));
 diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));
 diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72);
 `),l=o(l,"normal=normalize(mix(normal,nonPerturbedNormal,rfArea));","normal=normalize(mix(normal,nonPerturbedNormal,rfArea*(1.-uSDOn*(.025+clamp(uSDDetail,0.,1.5)*.03))));"),l=o(l,"vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);","vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);float sdId=sdHash(vec3(float(id),uSDSeed,7.));if(uSDOn>.5){if(sdId>.86)continue;a.w*=uSDPoreScale*mix(.82,1.14,sdId);b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)));}");let u="cSkinMask*=1.-eaM;cLobeWeight*=1.-rfArea*.82;";l=o(l,u,u+`
 float sdDryness=clamp((1.-uSDHydration)*.7+uSDDry*.6+csDry*.28,0.,1.);
 sdOil=clamp(uSDOil*(.28+.72*csT)+uSDSweat*.58,0.,1.);
 sdRough=clamp(.56+sdDryness*.105-sdOil*.19,.33,.84);
 roughnessFactor=mix(roughnessFactor,sdRough,sdSkin);
 cLobeWeight=mix(cLobeWeight,.06+sdOil*.25,sdSkin);
 // No synthesized noise heights or age-shaped channels in R02.
 // Preserved native microdetail is bounded above, not replaced by invented marks.

 `);let d="material.specularColor=mix(material.specularColor,vec3(.032)*(1.+uRFOil*.10),rfArea);";l=o(l,d,d+"material.specularColor=mix(material.specularColor,vec3(.028),sdSkin);");let f="material.clearcoatRoughness=mix(material.clearcoatRoughness,.50,rfArea);";l=o(l,f,f+"material.clearcoat=mix(material.clearcoat,uSDSweat*.12,sdSkin);material.clearcoatRoughness=mix(material.clearcoatRoughness,.32,sdSkin);"),l=o(l,"vec3 rfW=vec3(.28,.14,.075)*uRFScatter;","vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn);"),l=o(l,"#include <opaque_fragment>",`
 if(uSDView>.5&&uSDView<1.5)outgoingLight=diffuseColor.rgb;
 if(uSDView>1.5&&uSDView<2.5)outgoingLight=mix(outgoingLight,vec3(roughnessFactor),sdCover);
 if(uSDView>2.5&&uSDView<3.5)outgoingLight=normal*.5+.5;
 if(uSDView>3.5&&uSDView<4.5)outgoingLight=mix(outgoingLight,vec3(sdPigment),sdCover);
 #include <opaque_fragment>`),a.fragmentShader=l,s.compiles++,s.fragmentBytes=l.length,s.uniforms=Object.keys(i)},t.customProgramCacheKey=()=>n()+"/skin-dna-r02-1-bioskin-v1",t.needsUpdate=!0,{U:i,report:s,update(a,l=0){let h=a.profile,u=a.state,d={On:a.enabled?1:0,Mel:h.melanin,Blood:h.blood,Variation:h.variation,Freckles:h.freckles,Sun:h.sun,Age:h.age,Oil:h.oil,Hydration:h.hydration,Pores:h.pores,PoreScale:h.poreScale,Detail:h.detail,Flush:u.flush,Sweat:u.sweat,Dry:u.dryness,View:l,Seed:h.seed};for(let[f,p]of Object.entries(d))i["uSD"+f].value=p;i.uSDOffset.value=es(h.seed)},dispose(){t.onBeforeCompile=e,t.customProgramCacheKey=n,t.needsUpdate=!0}}}function is(c=512,t=256){let e=new Float32Array(c*t*4),n=r=>Math.atan2(Math.sin(r),Math.cos(r)),i=(r,s,o,a,l,h)=>Math.exp(-((n(r-o)/l)**4+((s-a)/h)**4)*2);for(let r=0;r<t;r++)for(let s=0;s<c;s++){let o=(s+.5)/c*Math.PI*2-Math.PI,a=Math.PI*.5-(r+.5)/t*Math.PI,l=i(o,a,-.7,.55,.47,.48)*4.8,h=i(o,a,.85,.15,.75,.65)*1.4,u=i(o,a,2.5,1,1.2,.3)*1.5,d=(r*c+s)*4,f=.085+.095*Math.max(Math.sin(a),0)+l+h+u;e[d]=e[d+1]=e[d+2]=f,e[d+3]=1}return e}var Jc=c=>{for(let t=c;t;t=t.parent)if(!t.visible)return!1;return!0};function rs(c){let t=c.scene,e=c.renderer,n=c.setFoldLook,i=new an;i.name="LOCAL-R03 calibrated neutral studio",i.visible=!1,t.add(i);let r=new me(16777215,2.5),s=new me(16777215,.55),o=new me(16777215,.38);r.name="Neutral main",s.name="Neutral fill",o.name="Neutral rim";for(let[A,y]of[r,s,o].entries())i.add(y,y.target),y.castShadow=A!==1,y.shadow.mapSize.set(A===0?2048:1024,A===0?2048:1024),Object.assign(y.shadow.camera,{left:-.62,right:.62,top:.62,bottom:-.62,near:.05,far:3.8}),y.shadow.bias=-22e-6,y.shadow.normalBias=25e-5,y.shadow.radius=5,y.shadow.camera.updateProjectionMatrix();let a=!1,l,h,u=0,d="",f=!1,p=.62;function m(){return{environment:t.environment,intensity:t.environmentIntensity,rotation:t.environmentRotation.clone(),tone:e.toneMapping,exposure:e.toneMappingExposure,clear:e.getClearColor(new L),alpha:e.getClearAlpha(),shadow:{enabled:e.shadowMap.enabled,type:e.shadowMap.type,autoUpdate:e.shadowMap.autoUpdate},cast:c.mesh.castShadow,receive:c.mesh.receiveShadow,lights:t.children.filter(A=>A.isLight).map(A=>[A,A.visible])}}function v(){if(l){t.environment=l.environment,t.environmentIntensity=l.intensity,t.environmentRotation.copy(l.rotation),e.toneMapping=l.tone,e.toneMappingExposure=l.exposure,e.setClearColor(l.clear,l.alpha),Object.assign(e.shadowMap,l.shadow),e.shadowMap.needsUpdate=!0,c.mesh.castShadow=l.cast,c.mesh.receiveShadow=l.receive;for(let[A,y]of l.lights)A.visible=y;i.visible=!1,a=!1,l=null,c.foldLightKey="",c.foldLastMode=null}}function g(){if(h)return;let A=new ln(is(),512,256,dn,bi);A.mapping=Hr,A.colorSpace=Pe,A.minFilter=A.magFilter=bt,A.needsUpdate=!0;let y=new on(e);try{h=y.fromEquirectangular(A),u++}finally{y.dispose(),A.dispose()}}function _(){if(f)return;let A=c.model.localFeatures.settings;if(!A.lighting){a&&v(),n.call(c);return}a||(l=m(),a=!0),n.call(c),g(),i.visible=!0,c.foldLights&&(c.foldLights.group.visible=!1),c.cineRig&&(c.cineRig.group.visible=!1,c.cineRig.U.uCShadowEnable.value=0);for(let D of t.children)D.isLight&&(D.visible=!1);let y=c.cineRig?.center||new x(0,.715,0),U=A.azimuth*Math.PI/180,P=A.elevation*Math.PI/180,E=2*c.camera.position.distanceTo(c.orbit.target)*Math.tan(c.camera.fov*Math.PI/360)/c.camera.zoom,M=E<.5?.24:E>.7?1.75:p;if(M!==p){p=M;for(let D of[r,s,o])Object.assign(D.shadow.camera,{left:-p,right:p,top:p,bottom:-p}),D.shadow.camera.updateProjectionMatrix();e.shadowMap.needsUpdate=!0}c.skinDNALights=[r,s,o];let T=[new x(Math.sin(U)*Math.cos(P),Math.sin(P),Math.cos(U)*Math.cos(P)),new x(-.65,.28,.8).normalize(),new x(-.28,.22,-1).normalize()];for(let[D,z]of[r,s,o].entries())z.target.position.copy(y),z.position.copy(y).addScaledVector(T[D],1.4),z.intensity=[A.key,A.fill,A.rim][D],z.shadow.radius=A.shadowFilter;t.environment=h.texture,t.environmentIntensity=A.environment,t.environmentRotation.set(0,100*Math.PI/180,0),e.toneMapping=Or,e.toneMappingExposure=A.exposure,e.setClearColor(2370610),e.shadowMap.enabled=!0,e.shadowMap.type=Nr,e.shadowMap.autoUpdate=!1,c.mesh.castShadow=c.mesh.receiveShadow=!0;let B=[p,A.azimuth,A.elevation,...y.toArray(),c.geometry.attributes.position.version,...c.mesh.morphTargetInfluences||[]].join(",");B!==d&&(e.shadowMap.needsUpdate=!0,d=B)}return c.setFoldLook=_,{apply:_,report(){let A=[];return t.traverse(y=>{y.isLight&&Jc(y)&&A.push({name:y.name,intensity:y.intensity,colour:y.color?.getHexString(),shadow:y.castShadow})}),{active:a,lights:A,environmentBuilds:u,neutralEnvironment:!0,shadowMaps:[2048,1024,1024],shadowSpanMetres:p,coveragePolicy:"head-scale / full-body frustum with camera-scale hysteresis",shadowFilterTexels:c.model.localFeatures.settings.shadowFilter,method:"Three r170 native 17-tap PCF, fixed filter radius and head-scale framing; not contact-hardening",transmission:"Retained R06 ear material, without R03 local shader stacking",fullAreaLightIntegration:!1,consumerGPUFPSCertified:!1}},dispose(){if(!f){v(),f=!0,c.setFoldLook=n,t.remove(i);for(let A of[r,s,o])A.shadow.dispose();h?.dispose()}}}}var wi=(c,t)=>[c[1]*t[2]-c[2]*t[1],c[2]*t[0]-c[0]*t[2],c[0]*t[1]-c[1]*t[0]],ut=(c,t)=>c[0]*t[0]+c[1]*t[1]+c[2]*t[2],J=(c,t)=>[c[0]-t[0],c[1]-t[1],c[2]-t[2]],ge=(c,t)=>[c[0]+t[0],c[1]+t[1],c[2]+t[2]],jt=(c,t)=>[c[0]*t,c[1]*t,c[2]*t],$c=c=>jt(c,1/(Math.hypot(...c)||1)),Ti=(c,t)=>[c[t*3],c[t*3+1],c[t*3+2]];function tl(c,t,e,n){let i=J(e,t),r=J(n,t),s=J(c,t),o=ut(i,s),a=ut(r,s);if(o<=0&&a<=0)return{p:t,b:[1,0,0]};let l=J(c,e),h=ut(i,l),u=ut(r,l);if(h>=0&&u<=h)return{p:e,b:[0,1,0]};let d=o*u-h*a;if(d<=0&&o>=0&&h<=0){let U=o/(o-h);return{p:ge(t,jt(i,U)),b:[1-U,U,0]}}let f=J(c,n),p=ut(i,f),m=ut(r,f);if(m>=0&&p<=m)return{p:n,b:[0,0,1]};let v=p*a-o*m;if(v<=0&&a>=0&&m<=0){let U=a/(a-m);return{p:ge(t,jt(r,U)),b:[1-U,0,U]}}let g=h*m-p*u;if(g<=0&&u-h>=0&&p-m>=0){let U=(u-h)/(u-h+p-m);return{p:ge(e,jt(J(n,e),U)),b:[0,1-U,U]}}let _=1/(g+v+d),A=v*_,y=d*_;return{p:ge(t,ge(jt(i,A),jt(r,y))),b:[1-A-y,A,y]}}var vn=class{constructor(t,e=t.template,n=null,i=[0]){let r=new Set(i);this.model=t,this.positions=e,this.faces=[];let s=t.triangles;for(let o=0;o<s.length/3;o++){if(n&&!n.has(o)||[0,1,2].some(u=>!r.has(t.componentId[s[o*3+u]])))continue;let a=Ti(e,s[o*3]),l=Ti(e,s[o*3+1]),h=Ti(e,s[o*3+2]);this.faces.push({t:o,a,b:l,c:h,n:$c(wi(J(l,a),J(h,a))),min:a.map((u,d)=>Math.min(u,l[d],h[d])),max:a.map((u,d)=>Math.max(u,l[d],h[d])),center:a.map((u,d)=>(u+l[d]+h[d])/3)})}this.root=this.build(this.faces)}build(t){let e=[1/0,1/0,1/0],n=[-1/0,-1/0,-1/0];for(let o of t)for(let a=0;a<3;a++)e[a]=Math.min(e[a],o.min[a]),n[a]=Math.max(n[a],o.max[a]);let i={min:e,max:n};if(t.length<=12)return i.faces=t,i;let r=0;for(let o=1;o<3;o++)n[o]-e[o]>n[r]-e[r]&&(r=o);t.sort((o,a)=>o.center[r]-a.center[r]);let s=t.length>>1;return i.left=this.build(t.slice(0,s)),i.right=this.build(t.slice(s)),i}segmentHit(t,e){let n=J(e,t),i=null,r=1,s=a=>{let l=0,h=r;for(let u=0;u<3;u++)if(Math.abs(n[u])<1e-16){if(t[u]<a.min[u]||t[u]>a.max[u])return!1}else{let d=(a.min[u]-t[u])/n[u],f=(a.max[u]-t[u])/n[u];if(d>f){let p=d;d=f,f=p}if(l=Math.max(l,d),h=Math.min(h,f),l>h)return!1}return!0},o=a=>{if(s(a))if(a.faces)for(let l of a.faces){let h=J(l.b,l.a),u=J(l.c,l.a),d=wi(n,u),f=ut(h,d);if(Math.abs(f)<1e-16)continue;let p=1/f,m=J(t,l.a),v=ut(m,d)*p;if(v<0||v>1)continue;let g=wi(m,h),_=ut(n,g)*p;if(_<0||v+_>1)continue;let A=ut(u,g)*p;A>=0&&A<=r&&(r=A,i={t:A,point:ge(t,jt(n,A)),normal:l.n,triangle:l.t})}else o(a.left),o(a.right)};return o(this.root),i}nearest(t){let e=null,n=1/0,i=s=>{let o=0;for(let a=0;a<3;a++)o+=(t[a]<s.min[a]?s.min[a]-t[a]:t[a]>s.max[a]?t[a]-s.max[a]:0)**2;return o},r=s=>{if(!(i(s)>n))if(s.faces)for(let o of s.faces){let a=tl(t,o.a,o.b,o.c),l=ut(J(t,a.p),J(t,a.p));l<n&&(n=l,e={...a,t:o.t,n:o.n,distance:Math.sqrt(l)})}else{let o=i(s.left),a=i(s.right);o<a?(r(s.left),r(s.right)):(r(s.right),r(s.left))}};return r(this.root),e}};var Di=[{id:3,name:"Mindfront 03",count:1212,counts:"BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",points:"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",sourceSha256:"f8804d51c4e61c4309a0705d33f089986ba5fde0bb46830b48cc75ec7bf392fd"}];var Li=(c,t)=>c.reduce((e,n,i)=>e+n*t[i],0),gn=(c,t)=>c.map((e,n)=>e-t[n]),el=(c,t)=>[c[1]*t[2]-c[2]*t[1],c[2]*t[0]-c[0]*t[2],c[0]*t[1]-c[1]*t[0]],Bi=c=>{let t=Math.hypot(...c);if(!Number.isFinite(t)||t<1e-8)throw Error("Degenerate face frame");return c.map(e=>e/t)},ss=new WeakMap;function os(c,t){let e=ss.get(t);if(!e){let i=Math.min(...t.map(a=>Math.abs(a[0]))),r=Math.max(...t.map(a=>Math.abs(a[0])));if(r-i<1e-5)throw Error("Degenerate brow span");let s=t.map(a=>{let l=(Math.abs(a[0])-i)/(r-i);return[1,l,l*l]}),o=a=>{let l=Array.from({length:3},(h,u)=>[...Array.from({length:3},(d,f)=>s.reduce((p,m)=>p+m[u]*m[f],0)),s.reduce((d,f,p)=>d+f[u]*t[p][a],0)]);for(let h=0;h<3;h++){let u=h;for(let f=h+1;f<3;f++)Math.abs(l[f][h])>Math.abs(l[u][h])&&(u=f);if([l[h],l[u]]=[l[u],l[h]],Math.abs(l[h][h])<1e-10)throw Error("Unidentifiable brow curve");let d=l[h][h];for(let f=h;f<4;f++)l[h][f]/=d;for(let f=0;f<3;f++)if(f!==h){let p=l[f][h];for(let m=h;m<4;m++)l[f][m]-=p*l[h][m]}}return l.map(h=>h[3])};e={lo:i,hi:r,coeff:[o(1),o(2)],sign:Math.sign(t[2][0])},ss.set(t,e)}let n=(c-e.lo)/(e.hi-e.lo);return[e.sign*c,...e.coeff.map(i=>i[0]+i[1]*n+i[2]*n*n)]}function as(c){let t=c[36],e=c[45],n=t.map((a,l)=>(a+e[l])/2),i=Bi(gn(e,t)),r=gn(n,c[8]),s=Bi(r.map((a,l)=>a-i[l]*Li(r,i))),o=Bi(el(i,s));if(Li(gn(c[30],n),o)<=0)throw Error("Face frame points into head or landmark sides are reversed");return{convention:"eye-horizontal/chin-longitudinal/1",origin:n,x:i,y:s,z:o}}function xn(c,t,e=!1){let n=e?c:gn(c,t.origin);return[t.x,t.y,t.z].map(i=>Li(n,i))}function cs(c,t,e){let n=new Int32Array(e).fill(-1);return c.forEach(([i,r,s],o)=>{if(i===r&&s===0){if(n[i]>=0&&n[i]!==t+o)throw Error("Ambiguous exact source mapping");n[i]=t+o}}),n}function ls(c,t,e){return Array.from({length:68},(n,i)=>{let r=[0,0,0],s=0;for(let o=0;o<3;o++){let a=e[c.landmarkIndices[i*3+o]],l=c.landmarkWeights[i*3+o];if(a<0||!Number.isFinite(l)||l<0)throw Error("Missing landmark support");s+=l;for(let h=0;h<3;h++)r[h]+=t[a*3+h]*l}if(s<1e-8)throw Error("Empty landmark weights");return r.map(o=>o/s)})}function hs(c,t,e,n,i,r){let s=new Set;for(let l=0;l<t.length;l+=3){let[h,u,d]=t.slice(l,l+3);s.add(`${h},${u},${d}`),s.add(`${u},${d},${h}`),s.add(`${d},${h},${u}`)}let o=new Set,a=new Set;for(let l=0;l<r;l++){let h=n[l];if(!Number.isInteger(h)||h<0||h*3+2>=c.length)throw Error("Invalid support triangle");let u=Array.from(c.slice(h*3,h*3+3));for(let f of u){if(e[f]<0)throw Error("Missing exact source vertex");a.add(f)}if(!s.has(u.map(f=>e[f]).join(",")))throw Error("Missing or reversed support triangle");let d=Array.from(i.slice(l*3,l*3+3));if(d.some(f=>!Number.isFinite(f)||f<-1e-6||f>1+1e-6)||Math.abs(d.reduce((f,p)=>f+p,0)-1)>1e-5)throw Error("Invalid support barycentrics");o.add(h)}return{usedFaces:o,usedVertices:a}}var Rt={schema:"native-brow-band-profile/1",frameConvention:"eye-horizontal/chin-longitudinal/1",targetLocalAbsX:[.0105,.0515],targetCenterYCoeff:[.0148,.001,.009,-.0122],targetHalfWidthCoeff:[.0017,.003,-.0041],sourceAbsX:[.13910000026226044,.5416666865348816],sourceCenterYCoeff:[7.401087760925293,.13941283524036407,-.1588815301656723],sourceHalfWidthCoeff:[.021927832194792458,-.0016243330956924266,-.006904565507457394],targetWidthClampM:[18e-5,.0045],sourceHalfWidthFloor:.004,sourceStyle:3,sourceSha256:"f8804d51c4e61c4309a0705d33f089986ba5fde0bb46830b48cc75ec7bf392fd",scope:"R65 artistic brow band on unchanged R64; flatten transition, soften medial head, retain actual surface roots. No photographic pixels or measured person units.",fitViews:["E04 visible near brow","U07 both visible brows"],heldOutBrowView:"U05, previously seen for face but not used in this brow fit",notice:"Artistic native brow-band parameters. No source images or image target coordinates. Camera-conditioned; not measured physical person geometry."},An=(c,t)=>c.reduce((e,n,i)=>e+n*t**i,0),ki=(c,t,e)=>Math.max(t,Math.min(e,c));function us(c,t,e,n=Rt){if([...c,...t,e].some(d=>!Number.isFinite(d)))throw Error("Invalid brow source point");let[i,r]=n.sourceAbsX,[s,o]=n.targetLocalAbsX,a=(Math.abs(c[0])-i)/(r-i),l=Math.max(n.sourceHalfWidthFloor,An(n.sourceHalfWidthCoeff,a)),h=(c[1]-An(n.sourceCenterYCoeff,a))/l,u=ki(An(n.targetHalfWidthCoeff,a),...n.targetWidthClampM);return[Math.sign(t[0])*(s+(o-s)*a),An(n.targetCenterYCoeff,a)+h*u,e]}function ds(c){let[t,e]=Rt.sourceAbsX,n=ki((Math.abs(c)-t)/(e-t),0,1),i=r=>(r=ki(r,0,1),r*r*(3-2*r));return(.32+.68*i(n/.22))*(1-.6*i((n-.82)/.18))}var Fi=(c,t,e)=>Math.max(t,Math.min(e,c)),nl=(c,t,e)=>c+(t-c)*e,fs=c=>{let t=Math.hypot(...c)||1;return c.map(e=>e/t)};var Ri=(c,t,e,n)=>{let i=[0,0,0];for(let r=0;r<3;r++)for(let s=0;s<3;s++)i[s]+=t[c.triangles[e*3+r]*3+s]*n[r];return i},Ii=c=>{let t=c+1^2654435769;return t=Math.imul(t^t>>>16,569420461),((t^t>>>15)>>>0)/4294967296};function ps(c,t){let e=1/0;for(let n=1;n<t.length;n++){let i=t[n-1],r=t[n],s=r[0]-i[0],o=r[1]-i[1],a=Fi(((c[0]-i[0])*s+(c[1]-i[1])*o)/(s*s+o*o||1),0,1);e=Math.min(e,Math.hypot(c[0]-i[0]-a*s,c[1]-i[1]-a*o))}return e}var ms=c=>Uint8Array.from(atob(c),t=>t.charCodeAt(0));var vs=c=>1.5266593-.5647476*c+1.408603*c*c-2.3594694*c*c*c,Ni=new Map;function gs(c){if(Ni.has(c))return Ni.get(c);let t=Di.find(a=>a.id===c);if(!t)throw Error("Unknown Mindfront eyebrow style");let e=ms(t.points),n=new Float32Array(e.buffer),i=ms(t.counts),r=[],s=0;for(let a=0;a<i.length;a++){let l=[];for(let u=0;u<i[a];u++)l.push(Array.from(n.subarray(s,s+3))),s+=3;let h=[0];for(let u=1;u<l.length;u++)h.push(h[u-1]+Math.hypot(...l[u].map((d,f)=>d-l[u-1][f])));r.push({points:l,arc:h,total:h.at(-1)})}let o={data:t,curves:r};return Ni.set(c,o),o}function il(c,t){let e=Fi(t,0,1)*c.total,n=1;for(;n<c.arc.length-1&&c.arc[n]<e;)n++;let i=(e-c.arc[n-1])/(c.arc[n]-c.arc[n-1]||1);return c.points[n-1].map((r,s)=>nl(r,c.points[n][s],i))}var yn=class{constructor(t,e,n,i){if(this.model=t,this.capacity=Math.max(...Di.map(s=>s.count)),this.segments=10,this.per=this.segments+1,this.count=0,this.options={browsModel:3,browsDensity:92,browsLength:100,browsDirection:0,browsLift:6,...i.options},this.lines=[i.landmarks.slice(17,22),i.landmarks.slice(22,27)],this.eyes=[i.landmarks.slice(36,42),i.landmarks.slice(42,48)],this.eyes.forEach(s=>s.push(s[0])),!i.allowed.size)throw Error("No valid current-head brow surface");this.bvh=new vn(t,e,i.allowed),this.front=Math.max(...this.bvh.faces.map(s=>s.max[2]))+.025,this.back=Math.min(...this.bvh.faces.map(s=>s.min[2]))-.025;let r=this.capacity*this.per*2;this.geometry=new Lt;for(let s of["position","tangent","scalpNormal"])this.geometry.setAttribute(s,new X(new Float32Array(r*3),3).setUsage(fn));for(let s of["strandSide","along","strandRandom","strandRadius"])this.geometry.setAttribute(s,new X(new Float32Array(r),1).setUsage(fn));this.geometry.setIndex(new X(new Uint32Array(this.capacity*this.segments*6),1).setUsage(fn)),this.supportT=new Int32Array(this.capacity*this.per),this.supportB=new Float32Array(this.capacity*this.per*3),this.lifts=new Float32Array(this.capacity*this.per),this.rootTriangles=new Int32Array(this.capacity),this.rootBarycentrics=new Float32Array(this.capacity*3),this.templateRoots=new Float32Array(this.capacity*3),this.positions=new Float32Array(this.capacity*this.per*3),this.sourceIds=new Uint16Array(this.capacity),this.selected=new Uint8Array(this.capacity),this.mesh=new dt(this.geometry,new de),this.mesh.name="Mindfront CC0 surface-bound eyebrows",this.mesh.frustumCulled=!1,this.mesh.renderOrder=2,this.bind(),this.update(e,n)}project(t){let e=this.bvh.segmentHit([t[0],t[1],this.front],[t[0],t[1],this.back]),n=this.bvh.nearest(e?.point||t);return n&&Math.hypot(n.p[0]-t[0],n.p[1]-t[1])<.006&&Math.abs(n.p[2]-t[2])<.02?n:null}mapPoint(t,e){let n=e[0]<0?-1:1,i=this.lines.find(d=>Math.sign(d[2][0])===n),[r,s]=Rt.sourceAbsX,[o,a]=Rt.targetLocalAbsX,l=(Math.abs(t[0])-r)/(s-r),h=o+(a-o)*l,u=os(h,i)[2];return us(t,e,u)}bind(){let t=performance.now(),e=this.options,n=gs(e.browsModel);this.sourceData=n.data,this.count=0,this.rejectedRoots=0,this.minEyeGap=1/0;let i=0;for(let r=0;r<n.curves.length;r++){let s=n.curves[r],o=s.points[0],a=this.mapPoint(o,o),l=this.project(a);if(!l){this.rejectedRoots++;continue}let h=Math.min(...this.eyes.map(f=>ps(l.p,f)));if(Math.abs(l.p[0])<.004||h<.0035){this.rejectedRoots++;continue}this.minEyeGap=Math.min(this.minEyeGap,h);let u=this.count++;this.sourceIds[u]=r,this.rootTriangles[u]=l.t,this.rootBarycentrics.set(l.b,u*3),this.templateRoots.set(l.p,u*3);let d=l;for(let f=0;f<this.per;f++){let p=f/this.segments,m=il(s,p*e.browsLength/100),v=this.mapPoint(m,o),g=e.browsDirection*Math.PI/180,_=v[0]-a[0],A=v[1]-a[1];v[0]=a[0]+Math.cos(g)*_-Math.sin(g)*A,v[1]=a[1]+Math.sin(g)*_+Math.cos(g)*A;let y=f===0?l:this.project(v);(!y||Math.min(...this.eyes.map(M=>ps(y.p,M)))<.0025)&&(y=d),d=y;let U=u*this.per+f;this.supportT[U]=y.t,this.supportB.set(y.b,U*3);let P=m[2]-o[2]-(vs(Math.abs(m[0]))-vs(Math.abs(o[0]))),E=f===0?2e-5:45e-6+Fi(P*.085,0,.0018)*e.browsLift/10;this.lifts[U]=E,i=Math.max(i,E);for(let M=0;M<2;M++){let T=U*2+M;this.geometry.attributes.strandSide.array[T]=M?1:-1,this.geometry.attributes.along.array[T]=p,this.geometry.attributes.strandRandom.array[T]=Ii(r),this.geometry.attributes.strandRadius.array[T]=43e-6*(.78+.44*Ii(r))*(1-.89*p*p*p)}}}if(this.count<100)throw Error("Eyebrow retarget left too few safe roots");this.maxLift=i,this.bindMs=performance.now()-t,this.select();for(let r of["strandSide","along","strandRandom","strandRadius"])this.geometry.attributes[r].needsUpdate=!0}select(){this.selected.fill(0);let t=this.geometry.index.array,e=0;this.activeCount=0;for(let n=0;n<this.count;n++)if(!(Ii(this.sourceIds[n])>=this.options.browsDensity/100*ds(gs(this.options.browsModel).curves[this.sourceIds[n]].points[0][0]))){this.activeCount++,this.selected[n]=1;for(let i=0;i<this.segments;i++){let r=(n*this.per+i)*2;t.set([r,r+1,r+2,r+1,r+3,r+2],e),e+=6}}this.geometry.setDrawRange(0,e),this.geometry.index.needsUpdate=!0}update(t,e){this.surfacePositions=t,this.surfaceNormals=e;let n=this.geometry.attributes.position.array,i=this.geometry.attributes.scalpNormal.array,r=this.geometry.attributes.tangent.array;for(let s=0;s<this.count;s++)for(let o=0;o<this.per;o++){let a=s*this.per+o,l=this.supportT[a],h=this.supportB.subarray(a*3,a*3+3),u=Ri(this.model,t,l,h),d=fs(Ri(this.model,e,l,h));for(let f=0;f<3;f++){let p=u[f]+d[f]*this.lifts[a];this.positions[a*3+f]=p,n[a*6+f]=n[a*6+3+f]=p,i[a*6+f]=i[a*6+3+f]=d[f]}}for(let s=0;s<this.count;s++)for(let o=0;o<this.per;o++){let a=s*this.per+o,l=(s*this.per+Math.max(0,o-1))*3,h=(s*this.per+Math.min(this.segments,o+1))*3,u=fs([0,1,2].map(d=>this.positions[h+d]-this.positions[l+d]));for(let d=0;d<3;d++)r[a*6+d]=r[a*6+3+d]=u[d]}for(let s of["position","scalpNormal","tangent"])this.geometry.attributes[s].needsUpdate=!0}apply(t){let e=!1,n=!1;for(let i of Object.keys(this.options))if(!(t[i]===void 0||t[i]===this.options[i])){if(!Number.isFinite(t[i]))throw Error("Invalid eyebrow "+i);this.options[i]=t[i],i==="browsDensity"?n=!0:e=!0}this.options.browsModel<1&&(this.options.browsModel=1),e?(this.bind(),this.update(this.surfacePositions,this.surfaceNormals)):n&&this.select()}diagnostics(){let t=2166136261,e=0;for(let r=0;r<this.count;r++){let s=Ri(this.model,this.surfacePositions,this.rootTriangles[r],this.rootBarycentrics.subarray(r*3,r*3+3)),o=this.positions.subarray(r*this.per*3,r*this.per*3+3);e=Math.max(e,Math.hypot(...s.map((l,h)=>l-o[h])));let a=new Uint32Array(this.templateRoots.buffer,r*3*4,3);for(let l of a)t=Math.imul(t^l,16777619)}let n=2166136261,i=new Uint32Array(this.positions.buffer,0,this.count*this.per*3);for(let r of i)n=Math.imul(n^r,16777619);return{curveHash:n>>>0,source:"Mindfront MakeHuman Eyebrows01 CC0",style:this.options.browsModel,profile:Rt.schema,sourceCount:this.sourceData.count,count:this.count,activeCount:this.activeCount,rejectedRoots:this.rejectedRoots,rootHash:t>>>0,maxRootOffset:e,minNeutralEyeGap:this.minEyeGap,sourceSha256:this.sourceData.sourceSha256,finite:this.positions.subarray(0,this.count*this.per*3).every(Number.isFinite),triangleAttached:!0,meshOverlay:!1,bindMs:this.bindMs}}dispose(){this.geometry.dispose(),this.mesh.material.dispose()}};var Oi=(c,t,e)=>Math.max(t,Math.min(e,c)),As=new WeakMap,rl=["auto","blend","a2c"];function sl(c){if(!rl.includes(c))throw new Error("coverageResolve must be auto, blend or a2c");return c}var ys=`
attribute vec3 tangent;
attribute vec3 scalpNormal;
attribute float strandSide;
attribute float strandRadius;
attribute float along;
attribute float strandRandom;
uniform float viewportHeight;
uniform float radiusScale;
uniform float coverageAA;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
vec3 fiberSafeNormal(vec3 value, vec3 fallback) {
  float lengthSquared = dot(value, value);
  return lengthSquared > 1e-12 ? value * inversesqrt(lengthSquared) : fallback;
}
`,Us=`
  vec4 centerView = modelViewMatrix * vec4(position, 1.0);
  vec3 fiberTangent = fiberSafeNormal(mat3(modelViewMatrix) * tangent, vec3(0.0, 1.0, 0.0));
  // These GNM meshes use identity/uniform transforms. Computing this from the
  // active modelViewMatrix also avoids the stale object.normalMatrix in Three's
  // shadow pass, where only object.modelViewMatrix is refreshed.
  vec3 fiberNormal = fiberSafeNormal(mat3(modelViewMatrix) * scalpNormal, vec3(0.0, 0.0, 1.0));
  vec3 fiberView = isOrthographic ? vec3(0.0, 0.0, 1.0) : fiberSafeNormal(-centerView.xyz, vec3(0.0, 0.0, 1.0));
  vec3 fallbackAxis = abs(fiberTangent.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 fallbackSide = fiberSafeNormal(cross(fiberTangent, fiberNormal), normalize(cross(fiberTangent, fallbackAxis)));
  vec3 ribbonSide = fiberSafeNormal(cross(fiberTangent, fiberView), fallbackSide);
  vec4 centerClip = projectionMatrix * centerView;
  float worldPerPixel = 2.0 * abs(centerClip.w) / max(abs(projectionMatrix[1][1]) * viewportHeight, 1e-6);
  float physicalRadius = max(0.0, strandRadius * radiusScale);
  // A smooth filter support, not a minimum opaque width. The integral in the
  // fragment shader preserves subpixel area and tapers all the way to zero.
  float displayRadius = physicalRadius + coverageAA * worldPerPixel * 0.75;
  vec4 mvPosition = centerView + vec4(ribbonSide * strandSide * displayRadius, 0.0);
  gl_Position = projectionMatrix * mvPosition;
  vFiberAcross = strandSide * displayRadius;
  vFiberRadius = physicalRadius;
  vFiberRandom = strandRandom;
  vFiberAlong = along;
`,_s=`
// Integral of a unit-opacity interval [-radius,+radius] over a pixel footprint.
// fwidth makes the filter track the actual projected transverse footprint.
float fiberCoverage() {
  if (vFiberRadius <= 0.0) return 0.0;
  if (coverageAA < 0.5) return 1.0;
  float footprint = max(fwidth(vFiberAcross), 1e-9);
  float low = max(vFiberAcross - 0.5 * footprint, -vFiberRadius);
  float high = min(vFiberAcross + 0.5 * footprint, vFiberRadius);
  return clamp((high - low) / footprint, 0.0, 1.0);
}
`,ol=`
#include <common>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
${ys}
varying vec3 vFiberTangent;
varying vec3 vFiberNormal;
varying vec3 vFiberViewPosition;
void main() {
${Us}
  vFiberTangent = fiberTangent;
  vFiberNormal = fiberNormal;
  vFiberViewPosition = -centerView.xyz;
  // Sample shadow coordinates at the physical silhouette, not the extra
  // filter support; normal bias is controlled by each real scene light.
  vec3 worldSide = inverseTransformDirection(ribbonSide, viewMatrix);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  worldPosition.xyz += worldSide * strandSide * physicalRadius;
  vec3 transformedNormal = fiberNormal;
  #include <shadowmap_vertex>
  #include <logdepthbuf_vertex>
}
`,al=`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform vec3 hairColor;
uniform float roughness;
uniform float surfaceSpecular;
uniform float fiberOpacity;
uniform float coverageAA;
uniform float fiberShadows;
uniform float guideMode;
uniform float ambientGain;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
varying vec3 vFiberTangent;
varying vec3 vFiberNormal;
varying vec3 vFiberViewPosition;
${_s}
float fiberGaussian(float angle, float width) {
  float x = angle / max(width, 0.035);
  return exp(-0.5 * x * x);
}
vec3 fiberResponse(vec3 T, vec3 V, vec3 L, vec3 pigment) {
  float tL = clamp(dot(T, L), -0.9999, 0.9999);
  float tV = clamp(dot(T, V), -0.9999, 0.9999);
  float cosL = sqrt(max(0.0001, 1.0 - tL * tL));
  float cosV = sqrt(max(0.0001, 1.0 - tV * tV));
  // Reflection has opposite incident/outgoing longitudinal angles.
  float thetaHalf = 0.5 * (asin(tL) + asin(tV));
  float cosPhi = clamp((dot(L, V) - tL * tV) / max(cosL * cosV, 0.0001), -1.0, 1.0);
  float front = 0.5 + 0.5 * cosPhi;
  float back = 1.0 - front;
  float beta = mix(0.085, 0.38, clamp(roughness, 0.0, 1.0));
  float tilt = 0.045;
  float primary = fiberGaussian(thetaHalf + tilt, beta) * pow(front, 2.5);
  float broad = fiberGaussian(thetaHalf - 0.5 * tilt, beta * 1.9 + 0.06) * (0.30 + 0.70 * front);
  float transmission = fiberGaussian(thetaHalf, beta * 2.25 + 0.10) * back * back;
  // Dielectric Fresnel shape, capped to keep this unnormalized real-time lobe
  // bounded at grazing angles. This is an artistic BCSDF approximation.
  vec3 H = L + V;
  float hLength = max(length(H), 1e-5);
  float fresnel = min(0.35, 0.046 + 0.954 * pow(1.0 - clamp(dot(V, H / hLength), 0.0, 1.0), 5.0));
  float reflectedWeight = clamp(surfaceSpecular, 0.0, 0.25) * (0.25 + 0.75 * fresnel);
  vec3 reflected = vec3(primary * reflectedWeight);
  vec3 pigmented = pigment * (0.22 + 0.38 * broad);
  // A shorter absorption path gives a broader, coloured through-fibre lobe.
  vec3 transmitted = pow(max(pigment, vec3(0.00001)), vec3(0.80)) * (0.20 * transmission);
  // Every lobe is <=1; weighted reflectance remains bounded. Illumination and
  // each lamp's visibility multiply the response outside this function.
  return cosL * (reflected + pigmented + transmitted);
}
void main() {
  float alpha = fiberOpacity * fiberCoverage();
  if (alpha < 0.001) discard;
  vec3 T = normalize(vFiberTangent);
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vFiberViewPosition);
  vec3 N = normalize(vFiberNormal);
  vec3 pigment = clamp(hairColor * mix(0.78, 1.16, vFiberRandom), vec3(0.0), vec3(0.95));
  // No emission or unlit additive wash. With every light off, result is black.
  vec3 color = pigment * ambientLightColor * (0.20 * ambientGain);
  #if NUM_HEMI_LIGHTS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
      color += pigment * getHemisphereLightIrradiance(hemisphereLights[i], N) * (0.14 * ambientGain);
    }
    #pragma unroll_loop_end
  #endif
  #if NUM_DIR_LIGHTS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      {
      float visibility = 1.0;
      #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS)
        DirectionalLightShadow lampShadow = directionalLightShadows[i];
        if (receiveShadow && fiberShadows > 0.5) {
          visibility = getShadow(directionalShadowMap[i], lampShadow.shadowMapSize,
            lampShadow.shadowIntensity, lampShadow.shadowBias, lampShadow.shadowRadius,
            vDirectionalShadowCoord[i]);
        }
      #endif
      // Each light gets ONLY its own shadow visibility, including warm/cool.
      color += directionalLights[i].color * visibility *
        fiberResponse(T, V, normalize(directionalLights[i].direction), pigment);
      }
    }
    #pragma unroll_loop_end
  #endif
  if (guideMode > 0.5) color = mix(vec3(0.035, 0.36, 0.19), vec3(0.55, 0.23, 0.025), vFiberRandom);
  gl_FragColor = vec4(max(color, vec3(0.0)), alpha);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,cl=`
${ys}
varying vec2 vFiberDepthZW;
void main() {
${Us}
  vFiberDepthZW = gl_Position.zw;
}
`,ll=`
#include <packing>
uniform float fiberOpacity;
uniform float coverageAA;
uniform float shadowSeed;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
varying vec2 vFiberDepthZW;
${_s}
// Stable per-light/per-strand sample; no frame jitter and no camera-space split.
float fiberShadowThreshold(vec2 pixel, float seed) {
  vec3 p = fract(vec3(pixel.xyx) * 0.1031 + seed);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
void main() {
  float occupancy = clamp(fiberOpacity * fiberCoverage(), 0.0, 1.0);
  float threshold = fiberShadowThreshold(floor(gl_FragCoord.xy), vFiberRandom * 19.19 + shadowSeed);
  if (occupancy <= threshold) discard;
  float depth = 0.5 * vFiberDepthZW.x / vFiberDepthZW.y + 0.5;
  gl_FragColor = packDepthToRGBA(depth);
}
`;function we(c){let t=As.get(c);if(!t)throw new Error("Expected a material created by createFiberMaterial");return t}function bs(c){let t=we(c),e=t.coverageAA&&t.coverageResolve!=="blend"&&t.samples>1,n=!e&&(t.coverageAA||c.uniforms.fiberOpacity.value<1),i=c.alphaToCoverage!==e||c.transparent!==n;c.alphaToCoverage=e,c.transparent=n,c.depthWrite=!n,c.blending=je,c.forceSinglePass=!0,c.uniforms.coverageAA.value=t.coverageAA?1:0,t.coverageMode=t.coverageAA?e?"analytic-alpha-to-coverage":"analytic-alpha-blend":n?"hard-raster-alpha-blend":"hard-raster",t.coverageResolveFallback=t.coverageAA&&t.coverageResolve==="a2c"&&t.samples<=1?"A2C requested but current framebuffer has no multisample coverage; using analytic alpha blend":null,i&&(c.needsUpdate=!0)}function hl({color:c="#21170f",roughness:t=.42,specular:e=.095,radiusScale:n=1,opacity:i=1,coverageAA:r=!0,shadows:s=!0,guides:o=!1,ambientGain:a=1,coverageResolve:l="auto"}={}){sl(l);let h=new pt({name:"GNM r7 bounded fibre + per-light visibility",vertexShader:ol,fragmentShader:al,lights:!0,uniforms:Yr.merge([b.lights,{viewportHeight:{value:1},radiusScale:{value:Math.max(0,n)},coverageAA:{value:r?1:0},hairColor:{value:new L(c)},roughness:{value:Oi(t,0,1)},surfaceSpecular:{value:Oi(e,0,.25)},fiberOpacity:{value:Oi(i,0,1)},fiberShadows:{value:s?1:0},guideMode:{value:o?1:0},ambientGain:{value:Math.max(0,a)}}]),side:_i,depthTest:!0});return As.set(h,{coverageAA:!!r,coverageResolve:l,coverageResolveFallback:null,shadows:!!s,samples:0,drawingBuffer:[0,0],viewportHeight:1,coverageMode:"",meshes:new Set,shadowViewports:{},framebufferMeasured:!1}),bs(h),h}function ul(c){we(c);let t=new pt({name:"GNM r7 light-facing stochastic fibre depth",vertexShader:cl,fragmentShader:ll,uniforms:{viewportHeight:{value:1},radiusScale:c.uniforms.radiusScale,fiberOpacity:c.uniforms.fiberOpacity,coverageAA:{value:1},shadowSeed:{value:0}},side:_i,blending:Me,depthTest:!0,depthWrite:!0,transparent:!1,toneMapped:!1});return t.depthPacking=Vr,t}function xs(c,t){let e=we(c),n=t.getContext(),i=t.getRenderTarget(),r=n.getParameter(n.VIEWPORT);return e.drawingBuffer=[n.drawingBufferWidth,n.drawingBufferHeight],e.viewportHeight=Math.max(1,i?r[3]:n.drawingBufferHeight),e.samples=Math.max(0,Number(n.getParameter(n.SAMPLES))||0),e.framebufferMeasured=!0,c.uniforms.viewportHeight.value=e.viewportHeight,bs(c),zi(c)}function Es(c,{renderer:t,material:e,...n}={}){let i=!e,r=c.geometry;!r.getAttribute("scalpNormal")&&r.getAttribute("rootNormal")&&r.setAttribute("scalpNormal",r.getAttribute("rootNormal"));for(let h of["position","tangent","scalpNormal","strandSide","strandRadius","along","strandRandom"])if(!r.getAttribute(h))throw new Error(`Fibre geometry requires ${h}`);e=e||hl(n);let s=we(e),o=ul(e),a=c.onBeforeRender,l=c.onBeforeShadow;return c.material=e,c.customDepthMaterial=o,c.castShadow=c.receiveShadow=s.shadows,c.frustumCulled=!1,s.meshes.add(c),c.onBeforeRender=function(h,...u){a&&a.call(this,h,...u),xs(e,h)},c.onBeforeShadow=function(h,u,d,f,p,m,v){if(l&&l.call(this,h,u,d,f,p,m,v),m!==o)return;let g=h.getContext(),_=g.getParameter(g.VIEWPORT);o.uniforms.viewportHeight.value=Math.max(1,_[3]),o.uniforms.shadowSeed.value=f.id%97/97,o.uniformsNeedUpdate=!0,s.shadowViewports[f.id]=[_[2],_[3]]},t&&xs(e,t),{material:e,depthMaterial:o,dispose(){s.meshes.delete(c),c.onBeforeRender=a,c.onBeforeShadow=l,c.customDepthMaterial===o&&delete c.customDepthMaterial,o.dispose(),i&&e.dispose()}}}function zi(c){let t=we(c),e=c.uniforms;return{model:"bounded longitudinal/azimuthal fibre approximation",radiusAttribute:"strandRadius",radiusUnits:"world",radiusScale:e.radiusScale.value,coverageAA:t.coverageAA,coverageMode:t.coverageMode,coverageResolve:t.coverageResolve,coverageResolveFallback:t.coverageResolveFallback,alphaToCoverage:c.alphaToCoverage,actualSamples:t.samples,framebufferMeasured:t.framebufferMeasured,drawingBuffer:[...t.drawingBuffer],viewportHeight:t.viewportHeight,transparent:c.transparent,depthWrite:c.depthWrite,shadows:t.shadows,shadowMethod:"per-light native PCF, stochastic single-depth coverage",shadowViewports:{...t.shadowViewports},lightingSource:"scene directional lights; independent per-light visibility",roughness:e.roughness.value,surfaceSpecular:e.surfaceSpecular.value,colorLinear:e.hairColor.value.toArray(),opacity:e.fiberOpacity.value,ambientGain:e.ambientGain.value,guides:e.guideMode.value>.5,limitations:["no multiple scattering or deep opacity maps","no coloured shadow transmission","directional lights with PCF only","non-MSAA fallback uses order-dependent alpha blending"]}}function Ms(c,{options:t={},color:e="#40352f"}={}){let n=c.motion().controller.model,i=n.gnm,r=c.motion().viewer,s=cs(n.canonical.gnmRecipes,n.bodyCount,i.numVertices),o=r.geometry.attributes.position.array,a=ls(i,o,s),l=as(a),h=a.map(S=>xn(S,l));if(l.convention!==Rt.frameConvention)throw Error("Brow profile/frame convention mismatch");let u=new Float32Array(i.numVertices*3).fill(NaN),d=u.slice(),f=S=>{let V=r.geometry.attributes.position.array,N=r.geometry.attributes.normal.array;for(let rt of S){let R=s[rt];if(R<0)throw Error("Missing source vertex");u.set(xn(Array.from(V.subarray(R*3,R*3+3)),l),rt*3),d.set(xn(Array.from(N.subarray(R*3,R*3+3)),l,!0),rt*3)}},p=Array.from(s,(S,V)=>V).filter(S=>s[S]>=0);f(p);let m=h.slice(17,27),v=Math.min(...m.map(S=>S[0]))-.012,g=Math.max(...m.map(S=>S[0]))+.012,_=Math.min(...m.map(S=>S[1]))-.011,A=Math.max(...m.map(S=>S[1]))+.013,y=new Set;for(let S=0;S<i.triangles.length/3;S++){let V=Array.from(i.triangles.slice(S*3,S*3+3));V.some(N=>s[N]<0||i.componentId[N]!==0)||V.some(N=>u[N*3]>v&&u[N*3]<g&&u[N*3+1]>_&&u[N*3+1]<A&&d[N*3+2]>.2)&&y.add(S)}let U=new yn(i,u,d,{landmarks:h,allowed:y,options:t}),P=hs(i.triangles,n.faces,s,U.supportT,U.supportB,U.count*U.per),E=new G().makeBasis(new x(...l.x),new x(...l.y),new x(...l.z));E.setPosition(...l.origin);let M=Es(U.mesh,{renderer:r.renderer,color:e,roughness:.56,specular:.025,coverageResolve:"blend"});U.mesh.userData.platformAppearance=!0,r.scene.add(U.mesh);let T=r.render,B=!1,D=()=>{let S=2166136261;for(let V of[U.supportT.subarray(0,U.count*U.per),U.supportB.subarray(0,U.count*U.per*3)])for(let N of new Uint8Array(V.buffer,V.byteOffset,V.byteLength))S=Math.imul(S^N,16777619);return(S>>>0).toString(16)},z=D();function I(){B||(f(P.usedVertices),U.update(u,d),U.mesh.matrixAutoUpdate=!1,U.mesh.matrix.multiplyMatrices(r.mesh.matrix,E))}r.render=function(...S){return I(),T.apply(this,S)};function it(){if(I(),D()!==z)throw Error("Brow surface binding changed during deformation");let S=U.diagnostics();return{schema:"native-current-head-brows/1",sourceCommit:"be92fc5ec93336bc555e85af5abee334d3913d47",sourcePath:"kaopu-hair-workbench/fusion/r14/src/MakeHumanBrows.js",sourceLicense:"Mindfront MakeHuman Eyebrows01 CC0",style:3,options:{...U.options},bindingFingerprint:z,frame:l,usedFaces:P.usedFaces.size,usedVertices:P.usedVertices.size,allPointSupportsVerified:!0,missingSupports:0,orderedTrianglesVerified:!0,rootLiftMaxM:S.maxRootOffset,rootSurfaceErrorM:Math.abs(S.maxRootOffset-2e-5),diagnostics:{...S,invalidTriangles:0,invalidGuideTriangles:0},fiber:zi(M.material),topologySha256:n.canonical.topologySha256,adapterFingerprint:n.adapterFingerprint,identityBound:!0,expressionReprojects:!1}}return I(),r.render(),{report:it,bindingSnapshot:()=>({fingerprint:z}),dispose(){B||(B=!0,r.render=T,r.scene.remove(U.mesh),M.dispose(),U.dispose())}}}var dl=`
uniform float uDTScatter,uDTVeins,uDTMicro;
float sdHash(vec3 p);
float dtPores(vec3 p,float footprint){
 vec3 cell=floor(p/.18);float height=0.;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec3 c=cell+vec3(float(x),float(y),float(z));
  vec3 jitter=vec3(sdHash(c+1.7),sdHash(c+19.3),sdHash(c+47.1));
  vec3 d=(c+jitter)*.18-p;float radius=mix(.024,.040,sdHash(c+83.));
  float r2=radius*radius,filtered=r2+footprint*footprint*.22,d2=dot(d,d);
  height+=(-exp(-d2/filtered)+.13*exp(-d2/(filtered*2.8)))*.000008*(r2/filtered);
 }return height;
}
float dtWindow(float x,float a,float b){return smoothstep(a,a+3.,x)*(1.-smoothstep(b-3.,b,x));}
float dtVessel(vec3 p,float side){
 float y=p.y-304.,asym=side*.9;
 float mainX=63.5+.18*y+1.8*sin(y*.115+asym),d=(p.x-mainX)/1.15;
 float main=exp(-d*d)*dtWindow(p.y,280.,344.);
 float branchX=59.+.42*(p.y-315.)+1.4*sin((p.y-315.)*.15+asym),b=(p.x-branchX)/.80;
 float branch=exp(-b*b)*dtWindow(p.y,306.,334.);
 float cheekX=48.5+.48*(p.y-284.)+1.1*sin((p.y-284.)*.16+asym),c=(p.x-cheekX)/.95;
 float cheek=exp(-c*c)*dtWindow(p.y,271.,296.)*.48;
 float sideDepth=exp(-pow((p.z-23.)/28.,2.)),cheekDepth=exp(-pow((p.z-52.)/23.,2.));
 return clamp((main+branch*.60)*sideDepth+cheek*cheekDepth,0.,1.);
}
`;function Ps({model:c,viewer:t}){let e=t.skin.material,n=e.onBeforeCompile,i=e.customProgramCacheKey.bind(e),r={natural:{scatter:.48,veins:.18,micro:1.05,diffusion:!1},luminous:{scatter:.72,veins:.25,micro:1.18,diffusion:!0},thin:{scatter:.64,veins:.6,micro:1.1,diffusion:!0}},s={uDTScatter:{value:.72},uDTVeins:{value:.23},uDTMicro:{value:1.18}},o="luminous",a=(u,d,f)=>{if(u.split(d).length!==2)throw Error("Dermal material anchor changed: "+d.slice(0,90));return u.replace(d,()=>f)};e.onBeforeCompile=u=>{n(u),Object.assign(u.uniforms,s);let d=dl+`
`+u.fragmentShader;d=a(d,"diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));",`
 vec3 dtMM=vec3(abs(vFRest.x),vFRest.y,vFRest.z)*1000.;
 float dtV=dtVessel(dtMM,sign(vFRest.x))*uDTVeins*exp(-1.1-uSDMel*3.8)*sdSkin;
 // Soft depth-filtered absorption; this does not change normals or raise tubes.
 sdAlbedo*=exp(-vec3(.82,.23,.11)*dtV);
 float dtFlush=(.012*rfCheek+.010*rfThin)*uDTScatter*(1.-uSDMel*.65);
 sdAlbedo*=vec3(1.+dtFlush,1.-dtFlush*.48,1.-dtFlush*.34);
 diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));
 `),d=a(d,"b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)));","b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)))*uDTMicro*1.35;"),d=a(d,"rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;",`rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;
 float dtGrain=(sdNoise(rfMM*11.7)-.5)*.0000006;
 rfH+=dtGrain*uDTMicro*rfArea*(1.-smoothstep(.035,.105,rfFoot))*uSDOn;
 if(rfArea>.001&&rfFoot<.24&&uSDOn>.5)rfH+=dtPores(vFRest*1000.,rfFoot)*uDTMicro*rfArea*(1.-smoothstep(.10,.24,rfFoot))*uSDOn;
 `),d=a(d,"vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn);",`float dtThin=clamp(.24+.42*clamp(vFA.z,0.,1.)+.30*rfG(vFRest,vec3(.036,.277,.055),vec3(.032,.028,.055))+.20*clamp(vFA.w,0.,1.),0.,1.);
 vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn)+vec3(.38,.16,.075)*uDTScatter*dtThin*(1.-uSDMel*.58)*uSDOn;`),u.fragmentShader=d},e.customProgramCacheKey=()=>i()+"/dermal-optics-r01-depth-filtered",e.needsUpdate=!0;function l(u){let d=r[u];if(!d)throw Error("Unknown tissue preset");o=u,s.uDTScatter.value=d.scatter,s.uDTVeins.value=d.veins,s.uDTMicro.value=d.micro;let f=window.platformSkin?.archive().enabled??!0;c.foldProfile.settings.diffusion=d.diffusion&&f,c.faceSurface.settings.diffusion=d.diffusion&&f?.25:0,c.faceSurface.settings.radius=.82,t.render()}let h={select:l,refresh:()=>l(o),report:()=>({version:"DERMAL-OPTICS-R01",preset:o,...r[o],surfacePores:"retained surface candidates plus original cellular microrelief, bounded micrometre relief and pixel-footprint filtering",vessels:"soft procedural intradermal colour absorption on temples and upper cheeks; stable rest-space curves",scattering:"RGB angular approximation plus retained diffuse-only face diffusion; no volume path tracing",extraTextureSamplers:0,medicalMeasurement:!1})};return l(o),window.dermalOptics=h,h}window.platformInstallDermal=Ps;var Ss=(c,t,e)=>{if(c.split(t).length!==2)throw Error("Integration anchor changed: "+t);return c.replace(t,()=>e)};window.platformPackEyes=async(c,t)=>{let e=await Jr(["neOriginal0","neOriginal1","neClean"].map(r=>t[r].value)),n=c.material.onBeforeCompile,i=c.material.customProgramCacheKey.bind(c.material);c.material.onBeforeCompile=r=>{n(r),r.fragmentShader=Ss(r.fragmentShader,"uniform sampler2D neOriginal0,neOriginal1,neClean,neVessels;",`uniform highp sampler2DArray neColorLayers;
uniform sampler2D neVessels;`);for(let[s,o]of[["texture2D(neOriginal0,uv).rgb","texture(neColorLayers,vec3(uv,0.)).rgb"],["texture2D(neOriginal1,uv).rgb","texture(neColorLayers,vec3(uv,1.)).rgb"],["texture2D(neClean,suv).rgb","texture(neColorLayers,vec3(suv,2.)).rgb"]])r.fragmentShader=Ss(r.fragmentShader,s,o);r.uniforms.neColorLayers={value:e.texture};for(let s of["neOriginal0","neOriginal1","neClean"])delete r.uniforms[s]},c.material.customProgramCacheKey=()=>i()+"/platform-r021-exact-eye-array",c.material.needsUpdate=!0,c.eyeColorPacking=e,c.naturalEyeExtension.samplerPacking=e.report};window.platformInstallSkin=({model:c,viewer:t,controller:e})=>{if(window.platformSkin)return window.platformSkin;let n=t.regionalSkin,i=n.field.bind(n),r,s=mn();function o(d){let f=d.poreTexture;if(!f.userData.platformBioSkin){let p=f.image.data,m=p.length/2048,v=new Float32Array(p.length+17*2048);v.set(p);for(let g=0;g<17;g++)for(let _=0;_<33;_++){let A=(m+g)*2048+_*4,y=(g*33+_)*3;v.set(kt.data.slice(y,y+3),A),v[A+3]=1}f.image={data:v,width:512,height:v.length/2048},f.needsUpdate=!0,f.userData.platformBioSkin={row:m,originalBytes:p.byteLength}}i(d),r&&(r.U.uSDBioRow.value=f.userData.platformBioSkin.row)}n.field=o,o(t.currentFacePores),r=ns(t),r.U.uSDBioRow={value:t.currentFacePores.poreTexture.userData.platformBioSkin.row};let a=c.archive.bind(c),l=c.restore.bind(c);c.archive=()=>({...a(),skinDNA:structuredClone(s)}),c.restore=d=>{let f=d.skinDNA?pn(d.skinDNA):mn(),p=s;s=f;try{let m=l(d);return h(),m}catch(m){throw s=p,h(),m}};function h(){r.update(s),t.render()}let u={version:"PLATFORM-SKIN-R02.1",presets:Ce.map(({id:d,name:f,note:p})=>({id:d,name:f,note:p})),select(d){if(!Ce.some(f=>f.id===d))throw Error("Unknown skin preset");return s=mn(d),h(),this.archive()},archive:()=>structuredClone(s),restore(d){s=pn(d),h()},compare(){s={...s,enabled:!s.enabled},h()},report:()=>({version:"SKIN-DNA-R02.1+R06",recipe:structuredClone(s),material:r.report,eyePacking:t.skin.eyeColorPacking.report,sourceGeometryChanged:!1}),checkSampling:()=>t.skin.eyeColorPacking.checkSampling(t.renderer)};return window.platformSkin=u,h(),u};window.platformInstallStudio=({model:c,viewer:t})=>{c.localFeatures={settings:{lighting:!0,exposure:1.02,environment:.38,key:2.65,fill:.68,rim:.32,azimuth:32,elevation:25,shadowFilter:5}};let e=rs(t);return e.apply(),{preset(n){let i={studio:{exposure:1.02,environment:.38,key:2.65,fill:.68,rim:.32,azimuth:32,elevation:25},soft:{exposure:1.04,environment:.48,key:2.2,fill:.85,rim:.25,azimuth:-24,elevation:28},rake:{exposure:1.04,environment:.25,key:3,fill:.35,rim:.42,azimuth:68,elevation:22}};if(!i[n])throw Error("Unknown studio preset");Object.assign(c.localFeatures.settings,i[n]),e.apply(),t.render()},report:e.report}};window.platformInstallBrows=({controller:c})=>{let t,e="natural",n=!1,i={natural:{options:{browsDensity:86,browsLength:96,browsLift:5},color:"#393029"},soft:{options:{browsDensity:70,browsLength:92,browsLift:4},color:"#534236"},defined:{options:{browsDensity:96,browsLength:100,browsLift:5},color:"#27211d"}};function r(){if(!n){n=!0;try{t?.dispose(),t=Ms(window.fullCommonWorkbench,i[e])}finally{n=!1}}}r(),c.addEventListener("change",r);let s={select(o){if(!i[o])throw Error("Unknown brow preset");e=o,r()},report:()=>({preset:e,...t.report()})};return window.platformBrows=s,s};})();
/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
