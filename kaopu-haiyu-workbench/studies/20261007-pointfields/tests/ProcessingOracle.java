import java.io.*;
class ProcessingOracle {
 static float t=0;
 static float sin(float n){return (float)Math.sin(n);}
 static float cos(float n){return (float)Math.cos(n);}
 static void point(DataOutputStream out,float x,float y)throws Exception{out.writeFloat(x);out.writeFloat(y);}
 static void a(DataOutputStream out,float x,float y)throws Exception{
  float k=x/16-12.5f;
  float d=-5*Math.abs(sin(k/3)*sin(y/24));
  float q=x/4-y/3+60+(sin(t)+d*3+3)*k*sin(d*3+t+sin(d));
  float c=d/2+t/8;
  point(out,q*.7f*cos(c)+200,(q+y/2-d*19)*.7f*sin(c)+200);
 }
 public static void main(String[] args)throws Exception{
  DataOutputStream out=new DataOutputStream(new BufferedOutputStream(new FileOutputStream(args[0])));
  for(int frame=1;frame<=960;frame++){
   t+=.1f;
   if(frame==1||frame==60||frame==120||frame==240||frame==480||frame==960){out.writeInt(frame);out.writeFloat(t);for(int i=0;i<40000;i++)a(out,i%400,i/400);}
  }out.close();
 }
}
