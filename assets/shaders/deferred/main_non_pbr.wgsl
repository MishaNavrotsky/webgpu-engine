struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texCoords: vec2f,
  @location(1) worldPosition: vec3f,
}

struct Camera {
  projection: mat4x4<f32>,
  view: mat4x4<f32>,
  model: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  worldPosition: vec4f,
}

struct PointLight {
  worldPosition: vec4f,
  color: vec4f,
  irzz: vec4f,
}

struct Settings {
  mode: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage> pointLights: array<PointLight>;
@group(0) @binding(2) var<uniform> settings: Settings;


@group(1) @binding(0) var tAlbedo : texture_2d<f32>;
@group(1) @binding(1) var tEmissive : texture_2d<f32>;
@group(1) @binding(2) var tMetalicRoughness : texture_2d<f32>;
@group(1) @binding(3) var tpNormals : texture_2d<f32>;
@group(1) @binding(4) var tWorldPosition : texture_2d<f32>;
@group(1) @binding(5) var tvBiTangents : texture_2d<f32>;
@group(1) @binding(6) var tvNormals : texture_2d<f32>;
@group(1) @binding(7) var tvTangents : texture_2d<f32>;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) texCoords: vec2f) -> VertexOut {
  var out: VertexOut;
  out.position = position;
  out.texCoords = texCoords;

  var d = pointLights[0].color;


  var vertexWorldPosition = camera.model * position;
  out.worldPosition = vertexWorldPosition.xyz;

  return out;
}

@fragment
fn fragment_main(in: VertexOut) -> @location(0) vec4f {
  var pos = vec2i(floor(in.position.xy));

  var albedo = textureLoad(tAlbedo, pos, 0);
  var emissive = textureLoad(tEmissive, pos, 0);
  var metalicRoughness = textureLoad(tMetalicRoughness,  pos, 0);
  var pNormals = textureLoad(tpNormals, pos, 0);
  var worldPosition = textureLoad(tWorldPosition, pos, 0);
  var vBiTangents = textureLoad(tvBiTangents, pos, 0);
  var vNormals = textureLoad(tvNormals, pos, 0);
  var vTangents = textureLoad(tvTangents, pos, 0);

  switch settings.mode {
    case 1: {
      return albedo;
    }
    case 2: {
      return emissive;
    }
    case 3: {
      return metalicRoughness;
    }
    case 4: {
      return pNormals;
    }
    case 5: {
      return worldPosition;
    }
    case 6: {
      return vBiTangents;
    }
    case 7: {
      return vNormals;
    }
    case 8: {
      return vTangents;
    }
    default: {
      var T = vTangents.xyz;
      var B = vBiTangents.xyz;
      var N = vNormals.xyz;

      var TBN = mat3x3f(T, B, N);
      var s = pNormals.xyz * 2 - 1;
      var d = normalize(TBN * s);
      if (all(pNormals.xyz == vec3f(0,0,0))) {
        d = N;
      }

      for(var i: u32 = 0; i < arrayLength(&pointLights); i++) {
        var light = pointLights[i];
        var lightPos = pointLights[i].worldPosition.xyz;


        var dist = cos(1.57079633 / light.irzz.y * clamp(distance(worldPosition.xyz, light.worldPosition.xyz), 0, light.irzz.y)) * light.irzz.x;
        var lightDir   = normalize(lightPos - worldPosition.xyz);
        var viewDir    = normalize(camera.worldPosition.xyz - worldPosition.xyz);
        var halfwayDir = normalize(lightDir + viewDir);
        var spec = pow(max(dot(d, halfwayDir), 0.0), 16);
        var specular = light.color * spec;

        let diffuse = max(dot(d, normalize(light.worldPosition.xyz - worldPosition.xyz)), 0);

        albedo *= (diffuse + specular);
        albedo *= dist;
      }
      return albedo;
    }
  }
}