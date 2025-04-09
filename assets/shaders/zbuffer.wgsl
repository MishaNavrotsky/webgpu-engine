@group(0) @binding(0) var<uniform> projectionView: mat4x4<f32>;
@group(0) @binding(1) var<uniform> model: mat4x4<f32>;

@vertex
fn vertex_main(@location(0) position: vec4f) -> @builtin(position) {
  return projectionView * model * position;
}