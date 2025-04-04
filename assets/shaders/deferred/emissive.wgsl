struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var emissiveTexture : texture_2d<f32>;
@group(2) @binding(0) var emissiveTextureSampler : sampler;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * camera.model * position;
  out.texCoords = texCoords;

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  var emissive = textureSample(emissiveTexture, emissiveTextureSampler, in.texCoords.xy);

  return emissive;
}