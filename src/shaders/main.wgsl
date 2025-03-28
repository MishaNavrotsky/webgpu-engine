struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f
}

struct Uniforms {
  cursorX: f32,
  cursorY: f32,
}

struct Camera {
  model: mat4x4<f32>,
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> camera: Camera;

@group(1) @binding(0) var colorSampler: sampler;
@group(1) @binding(1) var colorTexture: texture_2d<f32>;
@group(1) @binding(2) var textureCoord: texture_2d<f32>;

@vertex
fn vertex_main(@location(0) position: vec4f) -> VertexOut {
  var output: VertexOut;
  output.position = camera.projection * camera.view * camera.model * position;
  output.texcoord = vec2f(0,0);

  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f {
  var l = pow(fragData.position.x - uniforms.cursorX, 2);
  var r = pow(fragData.position.y - uniforms.cursorY, 2);
  var v = camera.model * 2;

  var s = textureSample(colorTexture, colorSampler, fragData.texcoord);
  s[3] = 1;
  return s;
  // return vec4f(1, 0, 0, 1);
}