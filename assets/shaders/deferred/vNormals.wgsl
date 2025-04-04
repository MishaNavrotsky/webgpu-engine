struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normals: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) normals: vec3f) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.normals = normals;

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  return vec4f(in.normals, 1.0);
}