// Processing screenshot transcription. Explicit f32 preserves Java float arithmetic.
const F=Math.fround, S=x=>F(Math.sin(x)), C=x=>F(Math.cos(x));
let t=0;
function a(x,y){
  const k=F(F(x/16)-F(12.5));
  const d=F(-5*Math.abs(F(S(F(k/3))*S(F(y/24)))));
  const q=F(F(F(F(x/4)-F(y/3))+60)+F(F(F(F(S(t)+F(d*3))+3)*k)*S(F(F(F(d*3)+t)+S(d)))));
  const c=F(F(d/2)+F(t/8));
  point(F(F(F(q*F(.7))*C(c))+200),F(F(F(F(F(q+F(y/2))-F(d*19))*F(.7))*S(c))+200));
}
function draw(){
  if(!t)createCanvas(400,400);
  t=F(t+F(.1)); background(6); stroke(255);
  for(let i=0;i<40000;i++)a(i%400,Math.floor(i/400));
}
