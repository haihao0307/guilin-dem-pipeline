from pathlib import Path
import re, sys, hashlib, json
R=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
s=(R/'index.html').read_text()
m=re.search(r'<script>window.HK_DETAIL_DATA=(.*?);window.HK_STATION_DATA=(.*?);window.HK_MAP_DATA=(.*?);</script>',s)
assert m and m[2]!='null', 'Requires the validated full assembly HTML'
station='window.HK_STATION_DATA='+m[2]+';\n'
guard='''<script>
window.HKStationStatus=function(ok,error){
 window.HK_STATION_LOAD={ready:ok,error:error||null,asset:'station-data.js'};
 const button=document.querySelector('[data-map-view="kowloon"]');
 if(button){button.disabled=!ok;button.textContent=ok?'九龙站实装':'九龙站未加载';}
 const legend=document.querySelector('[data-station-status]');
 if(legend)legend.textContent=ok?'九龙 R05 构件实装；其余站为站台、大棚布局。':'九龙建筑未加载，地形仍可查看；请刷新重试。';
 if(!ok)for(const label of window.HK_MAP_DATA.labels)label.text=label.text.replace('旧九龙站 · R05 同源构件','旧九龙站 · 建筑未加载');
};
window.HKStationStatus(!!window.HK_STATION_DATA,window.HK_STATION_DATA?null:'station-data.js request failed or data unavailable');
</script>'''
s=s[:m.start()]+'<script src="./station-data.js"></script><script>window.HK_DETAIL_DATA='+m[1]+';window.HK_MAP_DATA='+m[3]+';</script>'+guard+s[m.end():]
s=s.replace('<button data-map-view="kowloon">九龙站实装</button>','<button data-map-view="kowloon" disabled>九龙站加载中</button>')
s=s.replace('<p>九龙 R05 构件实装；其余站为站台、大棚布局。</p>','<p data-station-status>九龙建筑正在加载；其余站为站台、大棚布局。</p>')
assert 'if(stSpec){' in s and '\n}\nconst labelLayer' in s
s=s.replace('if(stSpec){','if(stSpec){try{',1).replace('\n}\nconst labelLayer','\n}catch(error){window.HKStationStatus(false,String(error));}\n}\nconst labelLayer',1)
s=s.replace("qa.kowloonStation={status:'not-yet-sampled'}","qa.kowloonStation={status:window.HK_STATION_LOAD?.error?'load-failed':'not-yet-sampled',error:window.HK_STATION_LOAD?.error||null}",1)
for name,value in [('index.html',s),('station-data.js',station)]:
 (R/name).write_text(value)
print(json.dumps({name:{'bytes':(R/name).stat().st_size,'sha256':hashlib.sha256((R/name).read_bytes()).hexdigest()} for name in ['index.html','station-data.js']}))
