/*
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
    
    
    ▓              🌟  KuKo Day 123  🌟                
    
    ▓  Branching practice. Rewriting and getting more confortable
    ▓  with it
    
    ▓  Based on @sillsm
    ▓  https://www.shadertoy.com/view/XtyGzh
     
     
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
*/
#define SPEED iTime * 0.3

mat3 R(float a)
{
    float c=cos(a), s=sin(a);
    return mat3(c,s,0, -s,c,0, 0,0,1);
}

mat3 disp(vec2 d)
{
    return mat3(1,0,0, 0,1,0, d,1);
}

float sdCylinder(vec2 p, vec2 h)
{
    p -= vec2(0, h.y);
    vec2 d = abs(vec2(length(p.x),p.y)) - h;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 treeL(vec2 p)
{
    const float WID     = 0.0021;
    const float LEN0    = 0.42;
    const float ANG     = radians(20.0);
    const int   TOTAL   = 729;
    const int   DEPTH   = 6;
    const int   BR      = 3;
    
    p += vec2(1.2, 1.0);
    
    // trunk
    float dBranch = sdCylinder(p, vec2(WID, LEN0));
    float dLeaf   = 1e5;
    
    // angles 
    mat3 posR = R(-ANG);
    mat3 negR = R( ANG);
    
    int c = 0;
    for(int iter = 0; iter < TOTAL && c < TOTAL; iter++)
    {
        vec2 pLoc = p;
        int  off  = TOTAL;
        float  l  = LEN0;
        
        for(int i = 1; i <= DEPTH; i++)
        {
            l   *= 0.5;
            off /= BR;
            int dec  = c / off;
            int path = dec - BR * ( dec / BR); 
            
            mat3 wind0 = R(0.2 * sin(SPEED + 6.2));
            mat3 wind1 = R(0.2 * sin(SPEED + 1.0));
            
            mat3 mx; 
            if(path == 0){
                mx = wind0 * negR * disp(vec2(0, -2.0 * l));
            } else if(path == 1){
                mx =         posR * disp(vec2(0, -4.0 * l));
            } else {
                mx = wind1 * negR * disp(vec2(0, -4.0 * l));
            }
            
            pLoc = (mx * vec3(pLoc, 1)).xy;
            
            float y = sdCylinder(pLoc, vec2(WID, l));
            
            if( y - 2.0 * l > 0.0) {
                c += off - 1;
                break;
            }
            
            if(i == DEPTH - 1){
                float rLeaf = 0.4 * l;
                float leaf  = length(pLoc - vec2(0, 3.0 * l)) - rLeaf;
            
                dLeaf = min(dLeaf, leaf);
            }
            
            dBranch = min(dBranch, y);
        }
        c++;
    }
    return vec2(dBranch, dLeaf);
}

vec2 treeR(vec2 p)
{
    const float WID     = 0.001;
    const float LEN0    = 0.45;
    const float ANG     = radians(25.7);
    const int   TOTAL   = 1024;
    const int   DEPTH   = 5;
    const int   BR      = 4;
    
    p += vec2(-1.1, 1.);
    
    // trunk
    float dBranch = sdCylinder(p, vec2(WID, LEN0));
    float dLeaf   = 1e5;
    
    // angle 
    mat3 posR = R(-ANG);
    mat3 negR = R( ANG);
    
    int c = 0;
    
    for(int iter = 0; iter < TOTAL && c < TOTAL; iter++)
    {
        vec2  pLoc = p;
        int   off  = TOTAL;
        float l    = LEN0;
        
        for(int i = 1; i <= DEPTH; i++)
        {
            l   *= 0.5;
            off /= BR;
            
            int dec  = c / off;
            int path = dec - BR * (dec / BR);
            
            mat3 wind0 = R(0.2 * sin(SPEED + 6.2));
            mat3 wind1 = R(0.2 * sin(SPEED + 1.0));
            
            mat3 mx;
            if(path == 0){
                mx =         posR * disp(vec2(0, -1.0 * l));
            } else if(path == 1){
                mx = wind0 * negR * disp(vec2(0, -2.0 * l));
            } else if(path == 2){
                mx = wind1 *        disp(vec2(0, -4.0 * l));
            } else {
                mx =                disp(vec2(0, -0.0 * l)) * posR * disp(vec2(0, -4.0 * l));
            }
            
            pLoc = (mx * vec3(pLoc, 1.0)).xy;
            
            float y = sdCylinder(pLoc, vec2(WID, l));
            
            if(y - 3.0 * l > 0.0) 
            {
                c += off - 1; break;
            }
            
            if( i == DEPTH - 0){
                float rLeaf = 0.4 * l;
                float leaf  = length(pLoc - vec2(0.0, 2.0 * l)) - rLeaf;
                
                dLeaf = min(dLeaf, leaf);
            }
            dBranch = min(dBranch, y);
        }
        c++;
    }
    return vec2(dBranch, dLeaf);
}

vec2 tree(vec2 p)
{
    const float WID     = 0.001;
    const float LEN0    = 0.35;
    const float ANG     = radians(40.0);
    const int   TOTAL   = 2187;
    const int   DEPTH   = 7;
    const int   BR      = 3;
    
    p += vec2(0.05,1.0);
    
    // trunk
    float dBranch = sdCylinder(p, vec2(WID, LEN0));
    float dLeaf   = 1e5;
    
    // angles 
    mat3 posR = R(-ANG);
    mat3 negR = R( ANG);
    
    int c = 0;
    
    for(int iter = 0; iter < TOTAL && c < TOTAL; iter++)
    {
        vec2 pLoc = p;
        int off   = TOTAL;
        
        // length schedule
        float l = LEN0;
        
        for(int i = 1; i <= DEPTH; i++)
        {
            l *= 0.5;
            off /= BR;
            
            // mod 3 in {0,1,2}
            int dec  = c / off;
            int path = dec - BR * (dec / BR); 
            
            mat3 wind0 = R(0.2 * sin(SPEED + 6.2));
            mat3 wind1 = R(0.2 * sin(SPEED + 1.0));
            
            mat3 mx;
            if(path == 0){
                mx =         posR * disp(vec2(0, -1.0 * l));  // [+F]
            } else if(path == 1){
                mx = wind0 * negR * disp(vec2(0, -2.0 * l));  // F (width - ang)
            } else {
                mx = wind1 *        disp(vec2(0, -4.0 * l));  // [-F] (no rotation)
            }
            
            pLoc = (mx * vec3(pLoc, 1)).xy;
            
            // draw this segment
            float y = sdCylinder(pLoc, vec2(WID, l));
            dBranch = min(dBranch, y);
            
            if(y - 2.0 * l > 0.0) {
                c += off - 1;
                break;
            }
            
            if(i == DEPTH -2){
                float rLeaf = 0.915 * l;
                float leaf  = length(pLoc - vec2(0, 3.0 * l)) - rLeaf;
                dLeaf = min(dLeaf, leaf);
            }
        }
        c++;
    }
    return vec2(dBranch, dLeaf);
}

float glowFromSD(float sd, float px, float widthPx) {
    float x = max(sd, 0.0) / (widthPx * px); // only outside the leaf
    return exp(-x*x);                         // fast Gaussian falloff
}

void mainImage( out vec4 O, in vec2 I )
{
    vec2 uv = (2.0 * I - iResolution.xy)/ iResolution.y;
    vec3 col = vec3(uv.y);
    
    vec2 c = tree(uv);
    vec2 l = treeL(uv);
    vec2 r = treeR(uv);
    
    vec2 d = min(r, min(c, l));
    
    float px = 1.0 / iResolution.y;
    
    float wb = 0.0001; 
    // branch
    float mb = smoothstep(wb + 3.0 * px, wb - px, d.x); 
    // leaf
    float leafCore = smoothstep(0.0, -2.0 * px, d.y);
    
    vec3 bgColor   = vec3(0);
    vec3 branchCol = vec3(0.2, 0.9, 0.8);
    vec3 leafColor = vec3(0.5, 0.1, 0.3);
    
    col = mix(bgColor, branchCol, mb );
    col = mix(col, leafColor, leafCore);
    
    float halo = glowFromSD(d.y, px, 5.0);           
    col += leafColor * (0.15 * halo);                  
    col += leafColor * 1.0 * smoothstep(6.0*px, 0.0, d.y);
    
    O = vec4(col, 1.0);
}
