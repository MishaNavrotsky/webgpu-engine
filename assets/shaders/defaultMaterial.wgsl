struct VertexOut {
  @builtin(position) position: vec4f,
}

struct Camera {
  pvm: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn vertex_main(@location(0) position: vec4f) -> VertexOut {
  var output: VertexOut;
  output.position = camera.pvm * position;
  // var a = camera.pvm;
  // output.position = position;

  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f {
  return vec4f(1, 0.3, 0, 1);
}