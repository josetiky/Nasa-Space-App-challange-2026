--[[
  PROJECT ARES — MARS MISSION ATLAS
  Roblox Studio: Script del Landmark 3D de la Tormenta de Polvo de 2018 (Opportunity · Sol 5111)
  Ubicación en Roblox: ServerScriptService > OpportunityStormLandmark.lua
]]

local Workspace = game:GetService("Workspace")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local marsFolder = Workspace:WaitForChild("MarsMissionAtlas", 5) or Workspace
local landmarks = marsFolder:FindFirstChild("ScientificLandmarks") or marsFolder

-- 1. MODELO CONTENEDOR DEL LANDMARK
local stormModel = Instance.new("Model")
stormModel.Name = "Opportunity_DustStorm_2018_Landmark"
stormModel.Parent = landmarks

-- Duna de arena sobre la que reposa el rover
local baseDune = Instance.new("Part")
baseDune.Name = "BurialDune"
baseDune.Shape = Enum.PartType.Cylinder
baseDune.Size = Vector3.new(4, 28, 28)
baseDune.CFrame = CFrame.new(Vector3.new(0, 0, 0)) * CFrame.Angles(0, 0, math.rad(90))
baseDune.Anchored = true
baseDune.Material = Enum.Material.Sand
baseDune.Color = Color3.fromRGB(158, 75, 40) -- Polvo férrico marciano
baseDune.Parent = stormModel

-- Chasis enterrado e inclinado 12 grados en la ladera de Perseverance Valley
local roverBody = Instance.new("Part")
roverBody.Name = "Opportunity_Chassis_Buried"
roverBody.Size = Vector3.new(8, 3, 6)
roverBody.CFrame = CFrame.new(Vector3.new(0, 2.5, 0)) * CFrame.Angles(math.rad(12), math.rad(25), 0)
roverBody.Anchored = true
roverBody.Material = Enum.Material.CorrodedMetal
roverBody.Color = Color3.fromRGB(140, 70, 38)
roverBody.Parent = stormModel

-- Alas solares cubiertas de polvo (desactivadas)
local solarPanels = Instance.new("Part")
solarPanels.Name = "DustBlanketed_SolarPanels"
solarPanels.Size = Vector3.new(12, 0.4, 8)
solarPanels.CFrame = roverBody.CFrame * CFrame.new(0, 1.6, 0)
solarPanels.Anchored = true
solarPanels.Material = Enum.Material.Sand
solarPanels.Color = Color3.fromRGB(165, 82, 44)
solarPanels.Parent = stormModel

-- 2. PARTÍCULAS DE LA TORMENTA DE POLVO 2018 (VÓRTICE Y POLVO EN SUSPENSIÓN)
local stormEmitterPart = Instance.new("Part")
stormEmitterPart.Name = "StormParticleEmitter"
stormEmitterPart.Size = Vector3.new(2, 2, 2)
stormEmitterPart.Position = Vector3.new(0, 4, 0)
stormEmitterPart.Transparency = 1
stormEmitterPart.CanCollide = false
stormEmitterPart.Anchored = true
stormEmitterPart.Parent = stormModel

local dustEmitter = Instance.new("ParticleEmitter")
dustEmitter.Name = "SwirlingDustParticles"
dustEmitter.Rate = 180
dustEmitter.Lifetime = NumberRange.new(3, 6)
dustEmitter.Speed = NumberRange.new(15, 35)
dustEmitter.SpreadAngle = Vector2.new(45, 360)
dustEmitter.Color = ColorSequence.new({
    ColorSequenceKeypoint.new(0, Color3.fromRGB(220, 115, 60)),
    ColorSequenceKeypoint.new(0.5, Color3.fromRGB(175, 80, 40)),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(110, 45, 20))
})
dustEmitter.Transparency = NumberSequence.new({
    NumberSequenceKeypoint.new(0, 0.8),
    NumberSequenceKeypoint.new(0.3, 0.35),
    NumberSequenceKeypoint.new(1, 1.0)
})
dustEmitter.Size = NumberSequence.new({
    NumberSequenceKeypoint.new(0, 2),
    NumberSequenceKeypoint.new(1, 8)
})
dustEmitter.Rotation = NumberRange.new(0, 360)
dustEmitter.RotSpeed = NumberRange.new(-60, 60)
dustEmitter.Parent = stormEmitterPart

-- 3. PROXIMITY PROMPT / PLACA INTERACTIVA CIENTÍFICA
local promptPart = Instance.new("Part")
promptPart.Name = "LandmarkBeacon"
promptPart.Size = Vector3.new(1.5, 6, 1.5)
promptPart.Position = Vector3.new(0, 6, 0)
promptPart.Transparency = 0.4
promptPart.Material = Enum.Material.Neon
promptPart.Color = Color3.fromRGB(239, 68, 68) -- Rojo de alerta Sol 5111
promptPart.Anchored = true
promptPart.CanCollide = false
promptPart.Parent = stormModel

local prompt = Instance.new("ProximityPrompt")
prompt.ObjectText = "Opportunity (MER-B) · Sol 5111"
prompt.ActionText = "Consultar Registro de la Tormenta de Polvo de 2018"
prompt.HoldDuration = 0.5
prompt.MaxActivationDistance = 18
prompt.Parent = promptPart

prompt.Triggered:Connect(function(player)
    print("👨‍🚀 [ARES] " .. player.Name .. " inspeccionó el Landmark de Opportunity.")
    -- Disparar notificación en la interfaz del jugador (GUI)
    local playerGui = player:FindFirstChildOfClass("PlayerGui")
    if playerGui then
        local msg = Instance.new("Message")
        msg.Text = "[OPPORTUNITY · SOL 5111 - 10 JUNIO 2018]\nPerseverance Valley: Tormenta Global de Polvo de opacidad tau = 10.8.\nEl polvo cubrio por completo las alas solares, interrumpiendo la recarga tras 14 anos y 45.16 km de exploracion historica."
        msg.Parent = playerGui
        task.wait(6)
        msg:Destroy()
    end
end)

print("✓ [ARES] Landmark de Opportunity (Tormenta de Polvo 2018) instanciado correctamente.")
