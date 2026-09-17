use serde_json::json;

fn main() {
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::LowPower,
        force_fallback_adapter: true,
        compatible_surface: None,
    })).expect("Failed to create fallback adapter");
    let info = adapter.get_info();
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("KAOPU N15 WGSL device"),
        required_features: wgpu::Features::empty(),
        required_limits: wgpu::Limits::downlevel_defaults(),
        experimental_features: wgpu::ExperimentalFeatures::disabled(),
        memory_hints: wgpu::MemoryHints::MemoryUsage,
        trace: wgpu::Trace::Off,
    })).expect("Failed to create device");
    let module = device.create_shader_module(wgpu::include_wgsl!("hash.wgsl"));
    let output = device.create_buffer(&wgpu::BufferDescriptor { label: Some("N15 output"), size: 48, usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC, mapped_at_creation: false });
    let read = device.create_buffer(&wgpu::BufferDescriptor { label: Some("N15 readback"), size: 48, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
    let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("N15 layout"), entries: &[wgpu::BindGroupLayoutEntry {
            binding: 0, visibility: wgpu::ShaderStages::COMPUTE,
            ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Storage { read_only: false }, has_dynamic_offset: false, min_binding_size: None }, count: None,
        }],
    });
    let bind = device.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("N15 bind"), layout: &layout, entries: &[wgpu::BindGroupEntry { binding: 0, resource: output.as_entire_binding() }] });
    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("N15 pipeline layout"), bind_group_layouts: &[Some(&layout)], immediate_size: 0 });
    let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor { label: Some("N15 pipeline"), layout: Some(&pipeline_layout), module: &module, entry_point: Some("main"), compilation_options: wgpu::PipelineCompilationOptions::default(), cache: None });
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("N15 encoder") });
    {
        let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor { label: Some("N15 pass"), timestamp_writes: None });
        pass.set_pipeline(&pipeline); pass.set_bind_group(0, &bind, &[]); pass.dispatch_workgroups(12, 1, 1);
    }
    encoder.copy_buffer_to_buffer(&output, 0, &read, 0, 48);
    queue.submit([encoder.finish()]);
    let slice = read.slice(..); slice.map_async(wgpu::MapMode::Read, |_| {}); device.poll(wgpu::PollType::wait_indefinitely()).unwrap();
    let data = slice.get_mapped_range();
    let values: Vec<u32> = bytemuck::cast_slice::<u8, u32>(&data).to_vec();
    let hashes: Vec<String> = values.iter().map(|x| format!("0x{x:08x}")).collect();
    let expected = vec!["0x0ccf9faf","0x6e683c38","0x39dd06c6","0xe3f359d0","0x92c56eef","0x9e58184a","0xdccecdc0","0x01fce552","0x3b4ee4c6","0x5dd09b26","0xe9a375cf","0x20a7111b"];
    let exact = hashes.iter().map(String::as_str).eq(expected.iter().copied());
    let result = json!({"schema":"kaopu-wgpu-native-wgsl-n15-v1","wgpuVersion":"29.0.0","adapter":{"name":info.name,"backend":format!("{:?}",info.backend),"deviceType":format!("{:?}",info.device_type),"driver":info.driver,"driverInfo":info.driver_info},"hashes":hashes,"expected":expected,"exactMatch":exact,"summary":{"checks":4,"passed":if exact {4} else {3},"failed":if exact {0} else {1},"status":if exact {"pass"} else {"fail"}}});
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
    assert!(exact, "WGSL hashes differ from locked CPU/GLSL vectors");
}
