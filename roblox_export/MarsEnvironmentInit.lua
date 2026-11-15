--[[
  PROJECT ARES — MARS MISSION ATLAS
  Roblox Studio: Script de Inicialización y Física Marciana
  Ubicación en Roblox: ServerScriptService > MarsEnvironmentInit.lua
]]

local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")

print("♂ [ARES] Inicializando entorno físico y atmosférico de Marte...")

-- 1. FÍSICA PLANETARIA MARCIANA
-- Gravedad de Marte: 3.721 m/s² (aprox 38% de la gravedad terrestre).
-- En Roblox por defecto la gravedad terrestre es 196.2 studs/s².
-- Gravedad marciana en Roblox = 196.2 * 0.379 = 74.35 studs/s².
Workspace.Gravity = 74.35
print("✓ [ARES] Gravedad ajustada a Marte: 74.35 studs/s² (0.379 g)")

-- 2. ATMÓSFERA Y SKYBOX MARCIANO
Lighting.ClockTime = 14.5
Lighting.GeographicLatitude = 18.38 -- Latitud de Jezero
Lighting.Brightness = 1.45
Lighting.Ambient = Color3.fromRGB(130, 85, 60)
Lighting.OutdoorAmbient = Color3.fromRGB(165, 110, 80)
Lighting.ColorShift_Top = Color3.fromRGB(240, 185, 135)
Lighting.ColorShift_Bottom = Color3.fromRGB(80, 45, 30)

-- Atmósfera densa de polvo marciano
local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
if not atmosphere then
    atmosphere = Instance.new("Atmosphere")
    atmosphere.Parent = Lighting
end
atmosphere.Density = 0.32
atmosphere.Offset = 0.15
atmosphere.Color = Color3.fromRGB(215, 140, 95)
atmosphere.Decay = Color3.fromRGB(160, 75, 40)
atmosphere.Glare = 0.25
atmosphere.Haze = 1.8

-- Efecto de rayos de sol débiles a través del polvo
local sunRays = Lighting:FindFirstChildOfClass("SunRaysEffect")
if not sunRays then
    sunRays = Instance.new("SunRaysEffect")
    sunRays.Parent = Lighting
end
sunRays.Intensity = 0.12
sunRays.Spread = 0.65

-- 3. CARPETAS DE ORGANIZACIÓN EN WORKSPACE
local marsFolder = Workspace:FindFirstChild("MarsMissionAtlas")
if not marsFolder then
    marsFolder = Instance.new("Folder")
    marsFolder.Name = "MarsMissionAtlas"
    marsFolder.Parent = Workspace
end

local terrainsFolder = Instance.new("Folder")
terrainsFolder.Name = "MissionTerrains"
terrainsFolder.Parent = marsFolder

local landmarksFolder = Instance.new("Folder")
landmarksFolder.Name = "ScientificLandmarks"
landmarksFolder.Parent = marsFolder

print("✓ [ARES] Entorno atmosférico y carpetas estructuradas.")
