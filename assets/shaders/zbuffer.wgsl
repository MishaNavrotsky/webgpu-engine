struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  worldPosition: vec4f,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> projectionView: mat4x4<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
}

@vertex
fn vertex_main(@location(0) position: vec4f) -> VertexOut {
  var out: VertexOut;
  out.position = projectionView * camera.model * position;
  return out;
}