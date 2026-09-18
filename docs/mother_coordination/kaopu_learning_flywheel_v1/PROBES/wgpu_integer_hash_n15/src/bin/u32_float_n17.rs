use serde_json::json;

fn main(){
 let instance=wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
 let adapter=pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions{power_preference:wgpu::PowerPreference::LowPower,force_fallback_adapter:true,compatible_surface:None})).expect("adapter");
 let info=adapter.get_info();
 let(device,queue)=pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor{label:Some("KAOPU N17"),required_features:wgpu::Features::empty(),required_limits:wgpu::Limits::downlevel_defaults(),experimental_features:wgpu::ExperimentalFeatures::disabled(),memory_hints:wgpu::MemoryHints::MemoryUsage,trace:wgpu::Trace::Off})).expect("device");
 let module=device.create_shader_module(wgpu::include_wgsl!("../u32_float_n17.wgsl"));
 let output=device.create_buffer(&wgpu::BufferDescriptor{label:Some("N17 output"),size:96,usage:wgpu::BufferUsages::STORAGE|wgpu::BufferUsages::COPY_SRC,mapped_at_creation:false});
 let read=device.create_buffer(&wgpu::BufferDescriptor{label:Some("N17 read"),size:96,usage:wgpu::BufferUsages::COPY_DST|wgpu::BufferUsages::MAP_READ,mapped_at_creation:false});
 let layout=device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor{label:Some("N17 layout"),entries:&[wgpu::BindGroupLayoutEntry{binding:0,visibility:wgpu::ShaderStages::COMPUTE,ty:wgpu::BindingType::Buffer{ty:wgpu::BufferBindingType::Storage{read_only:false},has_dynamic_offset:false,min_binding_size:None},count:None}]});
 let bind=device.create_bind_group(&wgpu::BindGroupDescriptor{label:Some("N17 bind"),layout:&layout,entries:&[wgpu::BindGroupEntry{binding:0,resource:output.as_entire_binding()}]});
 let pl=device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor{label:Some("N17 pipeline layout"),bind_group_layouts:&[Some(&layout)],immediate_size:0});
 let pipeline=device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor{label:Some("N17 pipeline"),layout:Some(&pl),module:&module,entry_point:Some("main"),compilation_options:wgpu::PipelineCompilationOptions::default(),cache:None});
 let mut encoder=device.create_command_encoder(&wgpu::CommandEncoderDescriptor{label:Some("N17 encoder")});
 {let mut pass=encoder.begin_compute_pass(&wgpu::ComputePassDescriptor{label:Some("N17 pass"),timestamp_writes:None});pass.set_pipeline(&pipeline);pass.set_bind_group(0,&bind,&[]);pass.dispatch_workgroups(24,1,1);}
 encoder.copy_buffer_to_buffer(&output,0,&read,0,96);queue.submit([encoder.finish()]);
 let slice=read.slice(..);slice.map_async(wgpu::MapMode::Read,|_|{});device.poll(wgpu::PollType::wait_indefinitely()).unwrap();
 let data=slice.get_mapped_range();let values:Vec<u32>=bytemuck::cast_slice::<u8,u32>(&data).to_vec();
 let expected:[u32;24]=[0,0,0,0x2f800000,0,0,0x337f0000,0,0,0x33800000,0x33800000,0,0x3f7fffff,0x3f7fffff,0x3f7ffffe,0x3f800000,0x3f7fffff,0x3f7ffffe,0x3f800000,0x3f7fffff,0x3f7ffffe,0x3f800000,0x3f7fffff,0x3f7ffffe];
 let exact=values==expected;
 let result=json!({"schema":"kaopu-u32-float-wgsl-n17-v1","wgpuVersion":"29.0.0","adapter":{"name":info.name,"backend":format!("{:?}",info.backend),"deviceType":format!("{:?}",info.device_type),"driver":info.driver,"driverInfo":info.driver_info},"bits":values.iter().map(|v|format!("0x{v:08x}")).collect::<Vec<_>>(),"exactCpuMatch":exact,"summary":{"checks":4,"passed":if exact{4}else{3},"failed":if exact{0}else{1},"status":if exact{"pass"}else{"fail"}}});
 println!("{}",serde_json::to_string_pretty(&result).unwrap());assert!(exact,"WGSL mapping differs from locked CPU bits");
}
