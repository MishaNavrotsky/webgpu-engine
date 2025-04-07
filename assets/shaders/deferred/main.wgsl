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
  irtz: vec4f,
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

const PI = 3.14159265358979323846264338327950288;

fn getNormal(vt: vec3f, vbt: vec3f, vn: vec3f, pn: vec3f) -> vec3f {
  var T = vt;
  var B = vbt;
  var N = vn;

  var TBN = mat3x3f(T, B, N);
  var s = pn * 2 - 1;
  var d = normalize(TBN * s);
  if (all(pn == vec3f(0,0,0))) {
    d = N;
  }

  return d;
}

fn DistributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
  var a      = roughness*roughness;
  var a2     = a*a;
  var NdotH  = max(dot(N, H), 0.0);
  var NdotH2 = NdotH*NdotH;
	
  var num   = a2;
  var denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;
	
  return num / denom;
}

fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  var r = (roughness + 1.0);
  var k = (r*r) / 8.0;

  var num   = NdotV;
  var denom = NdotV * (1.0 - k) + k;
	
  return num / denom;
}
fn GeometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
  var NdotV = max(dot(N, V), 0.0);
  var NdotL = max(dot(N, L), 0.0);
  var ggx2  = GeometrySchlickGGX(NdotV, roughness);
  var ggx1  = GeometrySchlickGGX(NdotL, roughness);
	
  return ggx1 * ggx2;
}
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
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
      var N = getNormal(vTangents.xyz, vBiTangents.xyz, vNormals.xyz, pNormals.xyz);
      var V = normalize(camera.worldPosition.xyz - worldPosition.xyz);
      var metalic = metalicRoughness.b;
      var roughness = metalicRoughness.g;

      var F0 = vec3f(0.04);
      F0 = mix(F0, albedo.xyz, metalic);

      var Lo = vec3(0.0);
      for(var i: u32 = 0; i < arrayLength(&pointLights); i++) {
        var light = pointLights[i];
        var lightPos = pointLights[i].worldPosition.xyz;
        // calculate per-light radiance
        var L = normalize(lightPos - worldPosition.xyz);
        // if (true) {
        //   L = -vec3f(0, -1, 0);
        // }
        var H = normalize(V + L);
        var distance    = length(lightPos - worldPosition.xyz);
        var attenuation = 1.0 / (distance * distance);
        var radiance     = min(light.color.xyz, vec3f(1,1,1)) * attenuation * light.irtz.x;
        // if (true) {
        //   radiance = light.color.xyz;
        // }
        
        // cook-torrance brdf
        var NDF = DistributionGGX(N, H, roughness);        
        var G   = GeometrySmith(N, V, L, roughness);      
        var F    = fresnelSchlick(max(dot(H, V), 0.0), F0);       
        
        var kS = F;
        var kD = vec3(1.0) - kS;
        kD *= 1.0 - metalic;	  
        
        var numerator    = NDF * G * F;
        var denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        var specular     = numerator / denominator;  
            
        // add to outgoing radiance Lo
        var NdotL = max(dot(N, L), 0.0);                
        Lo += (kD * albedo.xyz / PI + specular) * radiance * NdotL; 
      }

      var ambient = vec3f(0.001) * albedo.xyz;
      var color = ambient + Lo;
      // HDR
      // color = color / (color + vec3(1.0));
      // color = pow(color, vec3(1.0/2.2));  
      return vec4(color, 0.0);
    }
  }
}