require([
	'goo/entities/GooRunner',
	'goo/entities/World',
	'goo/renderer/Material',
	'goo/renderer/shaders/ShaderLib',
	'goo/renderer/Camera',

	'goo/entities/components/CameraComponent',
	'goo/scripts/OrbitCamControlScript',
	'goo/entities/components/ScriptComponent',
	'goo/renderer/MeshData',
	'goo/entities/components/MeshRendererComponent',
	'goo/math/Vector3',
	'goo/renderer/light/PointLight',
	'goo/renderer/light/DirectionalLight',
	'goo/renderer/light/SpotLight',
	'goo/entities/components/LightComponent',
	'goo/geometrypack/PolyLine',
	'lib/V'
], function (
	GooRunner,
	World,
	Material,
	ShaderLib,
	Camera,

	CameraComponent,
	OrbitCamControlScript,
	ScriptComponent,
	MeshData,
	MeshRendererComponent,
	Vector3,
	PointLight,
	DirectionalLight,
	SpotLight,
	LightComponent,
	PolyLine,
	V
	) {
	'use strict';

	var goo = V.initGoo();
	var world = goo.world;

	var xGenerator = PolyLine.fromCubicSpline([
		0, 0, 0,
		1, 0, 0,
		1, 0.5, 0,
		0, 1, 0,
		-1, 1.5, 0,
		-1, 2, 0,
		0, 2, 0], 20);
	/*
	 var xGenerator = PolyLine.fromCubicSpline([
	 0, 0, 0,
	 1, 0, 0,
	 1, 0.5, 0,
	 0, 1, 0], 20);
	 */
	var yGenerator = PolyLine.fromCubicSpline([
		0, 0, 0,
		1, 0, 0,
		1, 0, 0.5,
		0, 0, 1,
		-1, 0, 1.5,
		-1, 0, 2,
		0, 0, 2], 20);

	// generator material
	var generatorMaterial = new Material(ShaderLib.simpleColored);

	// x generator
	world.createEntity(xGenerator, generatorMaterial, [-1, -1, 0]).addToWorld();

	// y generator
	world.createEntity(yGenerator, generatorMaterial, [-1, -1, 0]).addToWorld();

	// surface mesh data
	var surfaceMeshData = xGenerator.mul(yGenerator);

	// surface material
	var surfaceMaterial = new Material(ShaderLib.simpleLit);

	// surface entity
	world.createEntity(surfaceMeshData, surfaceMaterial, [0, -1, 0]).addToWorld();

	var normalsMeshData = surfaceMeshData.getNormalsMeshData(6);
	var normalsMaterial = new Material(ShaderLib.simpleColored);
	normalsMaterial.uniforms.color = [0.2, 1.0, 0.6];
	world.createEntity(normalsMeshData, normalsMaterial, [0, -1, 0]).addToWorld();

	V.addLights();

	V.addOrbitCamera(new Vector3(5, Math.PI / 2, 0));
});
