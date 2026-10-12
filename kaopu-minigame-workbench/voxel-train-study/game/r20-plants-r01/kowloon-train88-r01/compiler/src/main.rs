use std::{env,fs};
use naga::{back::glsl,valid::{Validator,ValidationFlags,Capabilities},proc::BoundsCheckPolicies,ShaderStage};
fn main()->Result<(),Box<dyn std::error::Error>>{
 let a:Vec<String>=env::args().collect();if a.len()!=4{return Err("usage: bridge input.wgsl output.frag entry".into());}
 eprintln!("Compiling {} -> {} (entry {})",a[1],a[2],a[3]);
 let source=fs::read_to_string(&a[1])?;let module=naga::front::wgsl::parse_str(&source).map_err(|e|e.emit_to_string(&source))?;
 let info=Validator::new(ValidationFlags::all(),Capabilities::empty()).validate(&module)?;
 let options=glsl::Options{version:glsl::Version::Embedded{version:300,is_webgl:true},writer_flags:glsl::WriterFlags::empty(),binding_map:Default::default(),zero_initialize_workgroup_memory:true};
 let pipeline=glsl::PipelineOptions{shader_stage:ShaderStage::Fragment,entry_point:a[3].clone(),multiview:None};
 let mut text=String::new();let mut writer=glsl::Writer::new(&mut text,&module,&info,&options,&pipeline,BoundsCheckPolicies::default())?;
 let reflection=writer.write()?;fs::write(&a[2],text)?;fs::write(format!("{}.reflection.txt",&a[2]),format!("{reflection:#?}"))?;Ok(())
}
