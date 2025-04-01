struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
}

struct Camera {
  pvm: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var colorTexture : texture_2d<f32>;;
@group(2) @binding(0) var colorSampler : sampler;


@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f) -> VertexOut {
  var output: VertexOut;
  output.position = camera.pvm * position;
  output.texCoords = texCoords;
  output.position.w += 1;

  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f {
  return textureSample(colorTexture, colorSampler, fragData.texCoords.xy);
}