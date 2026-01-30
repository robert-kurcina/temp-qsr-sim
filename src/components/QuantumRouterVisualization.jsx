import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const QuantumRouterVisualization = () => {
    const mountRef = useRef(null);

    useEffect(() => {
        const currentMount = mountRef.current;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.z = 20;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        currentMount.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(0, 0, 25);
        scene.add(pointLight);

        // Central Router
        const routerGeometry = new THREE.SphereGeometry(2, 32, 32);
        const routerMaterial = new THREE.MeshPhongMaterial({ color: 0x0077ff, emissive: 0x0077ff, emissiveIntensity: 0.5 });
        const router = new THREE.Mesh(routerGeometry, routerMaterial);
        scene.add(router);

        // Orbiting Nodes
        const nodesGroup = new THREE.Group();
        scene.add(nodesGroup);
        const nodeGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const nodeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffaa });
        const nodes = [];
        const nodeCount = 8;
        const orbitRadius = 8;

        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2;
            const x = Math.cos(angle) * orbitRadius;
            const y = Math.sin(angle) * orbitRadius;

            const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
            node.position.set(x, y, 0);
            nodesGroup.add(node);
            nodes.push(node);

            // Line from node to router
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([node.position, router.position]);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            nodesGroup.add(line);
        }

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            nodesGroup.rotation.z += 0.005;
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
            camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (currentMount) {
                currentMount.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} style={{ width: '100%', height: '600px', background: '#111' }}></div>;
};

export default QuantumRouterVisualization;
