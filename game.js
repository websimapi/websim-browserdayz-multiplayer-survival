import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Main game class
class BrowserDayZ {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        this.gameState = {
            isLoading: true,
            isPlaying: false,
            isPaused: false,
            isNight: false,
            timeOfDay: 12, // 24-hour format
            weather: 'clear',
        };
        this.player = {
            id: null,
            username: '',
            position: new THREE.Vector3(0, 1, 0),
            rotation: 0,
            health: 100,
            hunger: 100,
            thirst: 100,
            stamina: 100,
            inventory: [],
            isRunning: false,
            isCrouching: false,
            isAiming: false,
            equippedItem: null,
        };
        this.world = {
            terrain: null,
            objects: [],
            buildings: [],
            items: [],
            zombies: [],
            lootLocations: [],
            boundaries: {
                width: 1000,
                height: 1000
            }
        };
        this.assetLoader = {
            totalAssets: 0,
            loadedAssets: 0,
            manager: new THREE.LoadingManager()
        };
        this.inputController = {
            keys: {},
            mouse: {
                x: 0,
                y: 0,
                isDown: false,
                isDragging: false,
                movementTarget: null,
                moveClickStart: null,
                moveClickPosition: null,
                moveCountdown: 0
            }
        };
        this.multiplayer = null; // WebsimSocket will be initialized in setup
        this.peers = {}; // Store connected players
        this.chatMessages = [];
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.setupScene();
        this.setupLighting();
        this.setupCamera();
        this.setupRenderer();
        this.setupLoadingManager();
        this.setupEventListeners();
        this.setupMultiplayer();

        await this.loadAssets();
        this.createWorld();
        this.spawn();
        
        this.hideLoadingScreen();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
    }

    setupLighting() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        // Directional light to simulate sun
        this.sunlight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunlight.position.set(0, 100, 0);
        this.sunlight.castShadow = true;
        this.sunlight.shadow.mapSize.width = 2048;
        this.sunlight.shadow.mapSize.height = 2048;
        this.sunlight.shadow.camera.near = 0.5;
        this.sunlight.shadow.camera.far = 500;
        this.sunlight.shadow.camera.left = -100;
        this.sunlight.shadow.camera.right = 100;
        this.sunlight.shadow.camera.top = 100;
        this.sunlight.shadow.camera.bottom = -100;
        this.scene.add(this.sunlight);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 5, 5);
        this.cameraContainer = new THREE.Object3D();
        this.cameraContainer.add(this.camera);
        this.scene.add(this.cameraContainer);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }

    setupLoadingManager() {
        this.assetLoader.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            this.assetLoader.loadedAssets = itemsLoaded;
            this.assetLoader.totalAssets = itemsTotal;
            const progress = (itemsLoaded / itemsTotal) * 100;
            document.getElementById('loading-bar').style.width = `${progress}%`;
            document.getElementById('loading-text').textContent = `Loading assets: ${Math.round(progress)}%`;
        };
        
        this.assetLoader.manager.onLoad = () => {
            console.log('All assets loaded');
        };
        
        this.assetLoader.manager.onError = (url) => {
            console.error('Error loading asset:', url);
        };
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Keyboard input
        document.addEventListener('keydown', (event) => {
            this.inputController.keys[event.code] = true;
            
            // Toggle inventory with 'I' key
            if (event.code === 'KeyI' && !this.gameState.isPaused) {
                const inventoryContainer = document.getElementById('inventory-container');
                if (inventoryContainer) {
                    inventoryContainer.style.display = 
                        inventoryContainer.style.display === 'none' ? 'block' : 'none';
                }
            }
            
            // Toggle crafting menu with 'C' key
            if (event.code === 'KeyC' && !this.gameState.isPaused) {
                const craftingContainer = document.getElementById('crafting-container');
                if (craftingContainer) {
                    craftingContainer.style.display = 
                        craftingContainer.style.display === 'none' ? 'block' : 'none';
                }
            }
            
            // Toggle pause menu with Escape key
            if (event.code === 'Escape') {
                this.togglePauseMenu();
            }
            
            // Handle chat input
            if (event.code === 'Enter') {
                const chatInput = document.getElementById('chat-input');
                if (document.activeElement === chatInput) {
                    this.sendChatMessage(chatInput.value);
                    chatInput.value = '';
                    // Blur the input to continue game control
                    chatInput.blur();
                } else {
                    // Focus the chat input
                    chatInput.focus();
                }
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.inputController.keys[event.code] = false;
        });
        
        // Mouse input
        document.addEventListener('mousemove', (event) => {
            if (this.gameState.isPaused) return;
            
            // Store mouse position for look direction
            this.inputController.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.inputController.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // Reset movement countdown if mouse has moved during countdown
            if (this.inputController.mouse.moveCountdown > 0) {
                const mousePos = { x: event.clientX, y: event.clientY };
                const clickPos = this.inputController.mouse.moveClickPosition;
                
                // Check if mouse has moved significantly from the click position
                if (clickPos && Math.abs(mousePos.x - clickPos.x) > 5 || Math.abs(mousePos.y - clickPos.y) > 5) {
                    this.inputController.mouse.moveCountdown = 0;
                    this.inputController.mouse.moveClickStart = null;
                    this.inputController.mouse.moveClickPosition = null;
                    
                    // Remove countdown indicator if it exists
                    const indicator = document.getElementById('move-countdown-indicator');
                    if (indicator) {
                        document.body.removeChild(indicator);
                    }
                }
            }
            
            // Edge scrolling for camera look only (not body rotation)
            const edgeThreshold = 0.15;
            const lookSpeed = 0.05;
            
            // Look up/down when mouse is near top/bottom edges
            if (this.inputController.mouse.y > 1 - edgeThreshold) {
                this.camera.rotation.x = Math.max(this.camera.rotation.x - lookSpeed, -Math.PI/4);
            } else if (this.inputController.mouse.y < -1 + edgeThreshold) {
                this.camera.rotation.x = Math.min(this.camera.rotation.x + lookSpeed, Math.PI/4);
            }
            
            // Look left/right by rotating the camera relative to the player's facing direction
            if (this.inputController.mouse.x > 1 - edgeThreshold) {
                this.camera.rotation.y = Math.min(this.camera.rotation.y + lookSpeed, Math.PI/4);
            } else if (this.inputController.mouse.x < -1 + edgeThreshold) {
                this.camera.rotation.y = Math.max(this.camera.rotation.y - lookSpeed, -Math.PI/4);
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (this.gameState.isPaused) return;
            
            if (event.button === 0) { // Left click
                // Create countdown indicator
                this.createMoveCountdownIndicator(event.clientX, event.clientY);
                
                // Start movement countdown
                this.inputController.mouse.moveClickStart = this.clock.elapsedTime;
                this.inputController.mouse.moveClickPosition = { x: event.clientX, y: event.clientY };
                this.inputController.mouse.moveCountdown = 3; // 3 second countdown
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) { // Left click
                // If mouseup happens quickly (before countdown), handle action immediately
                if (this.inputController.mouse.moveCountdown > 0 && 
                    this.clock.elapsedTime - this.inputController.mouse.moveClickStart < 0.3) {
                    
                    this.inputController.mouse.isDown = true;
                    this.inputController.mouse.isDragging = true;
                    this.inputController.mouse.movementTarget = this.getMouseWorldPosition();
                    this.handlePlayerAction();
                    
                    // Reset countdown
                    this.inputController.mouse.moveCountdown = 0;
                    
                    // Remove countdown indicator
                    const indicator = document.getElementById('move-countdown-indicator');
                    if (indicator) {
                        document.body.removeChild(indicator);
                    }
                }
            }
        });
        
        // Pointer lock for better FPS control
        this.renderer.domElement.addEventListener('click', () => {
            if (!this.gameState.isPaused) {
                // We don't use pointer lock anymore since we want to see the cursor
                // this.renderer.domElement.requestPointerLock();
            }
        });
    }

    createMoveCountdownIndicator(x, y) {
        // Remove existing indicator if it exists
        const existingIndicator = document.getElementById('move-countdown-indicator');
        if (existingIndicator) {
            document.body.removeChild(existingIndicator);
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.id = 'move-countdown-indicator';
        indicator.style.position = 'absolute';
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;
        indicator.style.transform = 'translate(-50%, -50%)';
        indicator.style.color = 'white';
        indicator.style.fontSize = '24px';
        indicator.style.fontWeight = 'bold';
        indicator.style.textShadow = '0 0 3px black';
        indicator.style.zIndex = '1000';
        indicator.style.userSelect = 'none';
        indicator.style.pointerEvents = 'none';
        indicator.innerText = '3';
        
        document.body.appendChild(indicator);
    }

    setupMultiplayer() {
        // Initialize WebsimSocket
        this.multiplayer = new WebsimSocket();
        
        // Set up event handler for incoming messages
        this.multiplayer.onmessage = (event) => {
            const data = event.data;
            
            switch (data.type) {
                case "connected":
                    console.log(`Player connected: ${data.username} (${data.clientId})`);
                    this.addSystemMessage(`${data.username} has joined the game`);
                    break;
                    
                case "disconnected":
                    console.log(`Player disconnected: ${data.username} (${data.clientId})`);
                    this.addSystemMessage(`${data.username} has left the game`);
                    this.removePlayer(data.clientId);
                    break;
                    
                case "playerMove":
                    this.updatePeerPosition(data.clientId, data.position, data.rotation);
                    break;
                    
                case "playerStatus":
                    this.updatePeerStatus(data.clientId, data.health, data.hunger, data.thirst);
                    break;
                    
                case "chatMessage":
                    this.addChatMessage(data.username, data.message);
                    break;
                    
                case "itemPickup":
                    this.removeWorldItem(data.itemId);
                    break;
                    
                case "zombieMove":
                    this.updateZombiePosition(data.zombieId, data.position);
                    break;
                
                case "playerAction":
                    this.handlePeerAction(data.clientId, data.action, data.targetId);
                    break;
                    
                default:
                    console.log("Received unknown event:", data);
            }
        };
        
        // Subscribe to peer updates
        this.multiplayer.party.subscribe((peers) => {
            // Update our local cache of peers
            this.peers = peers;
            // Update the UI
            this.updatePlayerList();
        });
        
        // Initialize player ID and username from the client
        this.player.id = this.multiplayer.party.client.id;
        this.player.username = this.multiplayer.party.client.username;
        
        console.log(`Player initialized: ${this.player.username} (${this.player.id})`);
    }

    async loadAssets() {
        return new Promise((resolve) => {
            const textureLoader = new THREE.TextureLoader(this.assetLoader.manager);
            
            // Load ground textures
            this.textures = {
                grass: textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg'),
                dirt: textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big-nm.jpg'),
                sand: textureLoader.load('https://threejs.org/examples/textures/terrain/backgrounddetailed6.jpg'),
            };
            
            // Apply texture settings
            this.textures.grass.wrapS = this.textures.grass.wrapT = THREE.RepeatWrapping;
            this.textures.grass.repeat.set(25, 25);
            
            // Create simple geometry for players and objects until we load actual models
            this.geometries = {
                player: new THREE.CylinderGeometry(0.5, 0.5, 2, 16),
                zombie: new THREE.CylinderGeometry(0.5, 0.5, 2, 16),
                tree: new THREE.CylinderGeometry(0.3, 0.5, 5, 8),
                bush: new THREE.SphereGeometry(0.5, 8, 8),
                rock: new THREE.DodecahedronGeometry(0.5, 0),
                building: new THREE.BoxGeometry(5, 3, 5),
                item: new THREE.BoxGeometry(0.3, 0.3, 0.3)
            };
            
            // Create materials
            this.materials = {
                player: new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
                zombie: new THREE.MeshStandardMaterial({ color: 0xff0000 }),
                tree: new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
                treeTop: new THREE.MeshStandardMaterial({ color: 0x228B22 }),
                bush: new THREE.MeshStandardMaterial({ color: 0x228B22 }),
                rock: new THREE.MeshStandardMaterial({ color: 0x888888 }),
                building: new THREE.MeshStandardMaterial({ color: 0xBBBBBB }),
                item: new THREE.MeshStandardMaterial({ color: 0xFFD700 })
            };
            
            // Simulate loading delay for demonstration
            setTimeout(() => {
                resolve();
            }, 2000);
        });
    }

    createWorld() {
        // Create the ground
        const groundGeometry = new THREE.PlaneGeometry(
            this.world.boundaries.width, 
            this.world.boundaries.height, 
            50, 50
        );
        groundGeometry.rotateX(-Math.PI / 2);
        
        const groundMaterial = new THREE.MeshStandardMaterial({
            map: this.textures.grass,
            normalMap: this.textures.dirt,
            roughness: 0.8,
            metalness: 0.2
        });
        
        this.world.terrain = new THREE.Mesh(groundGeometry, groundMaterial);
        this.world.terrain.receiveShadow = true;
        this.scene.add(this.world.terrain);
        
        // Add environment objects (trees, rocks, buildings)
        this.addEnvironmentObjects();
        
        // Add loot spawns
        this.addLootLocations();
        
        // Add initial zombies
        this.addZombies(20);
    }

    addEnvironmentObjects() {
        // Add trees
        for (let i = 0; i < 100; i++) {
            const position = this.getRandomPositionInWorld();
            this.addTree(position.x, position.y, position.z);
        }
        
        // Add rocks
        for (let i = 0; i < 50; i++) {
            const position = this.getRandomPositionInWorld();
            this.addRock(position.x, position.y, position.z);
        }
        
        // Add buildings
        for (let i = 0; i < 10; i++) {
            const position = this.getRandomPositionInWorld();
            this.addBuilding(position.x, position.y, position.z);
        }
    }

    addTree(x, y, z) {
        // Tree trunk
        const trunk = new THREE.Mesh(this.geometries.tree, this.materials.tree);
        trunk.position.set(x, y + 2.5, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        this.scene.add(trunk);
        
        // Tree top (foliage)
        const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
        const foliage = new THREE.Mesh(foliageGeometry, this.materials.treeTop);
        foliage.position.set(x, y + 5, z);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        this.scene.add(foliage);
        
        this.world.objects.push({ type: 'tree', trunk, foliage });
    }

    addRock(x, y, z) {
        const rock = new THREE.Mesh(this.geometries.rock, this.materials.rock);
        rock.position.set(x, y + 0.25, z);
        rock.scale.set(
            1 + Math.random() * 2,
            1 + Math.random(),
            1 + Math.random() * 2
        );
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
        
        this.world.objects.push({ type: 'rock', mesh: rock });
    }

    addBuilding(x, y, z) {
        const building = new THREE.Mesh(this.geometries.building, this.materials.building);
        building.position.set(x, y + 1.5, z);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);
        
        // Add building to the world objects and specifically to buildings array
        const buildingObj = { type: 'building', mesh: building, position: { x, y, z } };
        this.world.objects.push(buildingObj);
        this.world.buildings.push(buildingObj);
        
        // Add loot spawns inside building
        for (let i = 0; i < 3; i++) {
            const lootX = x + (Math.random() * 4 - 2);
            const lootZ = z + (Math.random() * 4 - 2);
            this.addLootLocation(lootX, y, lootZ, 'building');
        }
    }

    addLootLocations() {
        // Add random loot spawns in the world
        for (let i = 0; i < 50; i++) {
            const position = this.getRandomPositionInWorld();
            this.addLootLocation(position.x, position.y, position.z, 'world');
        }
    }

    addLootLocation(x, y, z, type) {
        const lootLocation = {
            position: { x, y, z },
            type: type,
            respawnTime: 300, // 5 minutes in seconds
            lastSpawn: 0
        };
        
        this.world.lootLocations.push(lootLocation);
        
        // Spawn initial item at this location
        if (Math.random() < 0.5) {
            this.spawnItemAtLocation(lootLocation);
        }
    }

    spawnItemAtLocation(lootLocation) {
        const itemTypes = ['food', 'water', 'medicine', 'weapon', 'ammo', 'tool'];
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        const item = {
            id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: itemType,
            position: { 
                x: lootLocation.position.x, 
                y: lootLocation.position.y + 0.15, 
                z: lootLocation.position.z 
            },
            quantity: Math.floor(Math.random() * 3) + 1
        };
        
        // Create visual representation
        const itemMesh = new THREE.Mesh(this.geometries.item, this.materials.item);
        itemMesh.position.set(item.position.x, item.position.y, item.position.z);
        itemMesh.castShadow = true;
        itemMesh.receiveShadow = true;
        this.scene.add(itemMesh);
        
        item.mesh = itemMesh;
        this.world.items.push(item);
        
        // Update the loot location's last spawn time
        lootLocation.lastSpawn = this.clock.elapsedTime;
    }

    addZombies(count) {
        for (let i = 0; i < count; i++) {
            const position = this.getRandomPositionInWorld();
            this.addZombie(position.x, position.y, position.z);
        }
    }

    addZombie(x, y, z) {
        const zombie = {
            id: 'zombie_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            position: { x, y: y + 1, z },
            health: 100,
            speed: 0.5 + Math.random() * 0.5,
            target: null,
            wanderTarget: this.getRandomPositionInWorld(),
            lastPathUpdate: 0,
            state: 'wandering', // wandering, chasing, attacking
            attackRange: 1.5,
            detectionRange: 15,
            damage: 10
        };
        
        // Create visual representation
        const zombieMesh = new THREE.Mesh(this.geometries.zombie, this.materials.zombie);
        zombieMesh.position.set(x, y + 1, z);
        zombieMesh.castShadow = true;
        zombieMesh.receiveShadow = true;
        this.scene.add(zombieMesh);
        
        zombie.mesh = zombieMesh;
        this.world.zombies.push(zombie);
    }

    updateZombies(deltaTime) {
        for (const zombie of this.world.zombies) {
            // Update zombie AI state
            this.updateZombieAI(zombie, deltaTime);
            
            // Update zombie movement based on its state
            switch (zombie.state) {
                case 'wandering':
                    this.moveZombieTowardsTarget(zombie, zombie.wanderTarget, zombie.speed * 0.5, deltaTime);
                    
                    // Check if reached wander target or needs a new one
                    const distToWanderTarget = this.distanceBetween(
                        zombie.position.x, zombie.position.z,
                        zombie.wanderTarget.x, zombie.wanderTarget.z
                    );
                    
                    if (distToWanderTarget < 1 || (this.clock.elapsedTime - zombie.lastPathUpdate) > 10) {
                        zombie.wanderTarget = this.getRandomPositionInWorld();
                        zombie.lastPathUpdate = this.clock.elapsedTime;
                    }
                    break;
                    
                case 'chasing':
                    // Make sure target still exists
                    if (zombie.target && this.isPlayerAlive(zombie.target)) {
                        const targetPosition = this.getPlayerPosition(zombie.target);
                        this.moveZombieTowardsTarget(zombie, targetPosition, zombie.speed, deltaTime);
                        
                        // Check if within attack range
                        const distToTarget = this.distanceBetween(
                            zombie.position.x, zombie.position.z,
                            targetPosition.x, targetPosition.z
                        );
                        
                        if (distToTarget <= zombie.attackRange) {
                            zombie.state = 'attacking';
                        }
                    } else {
                        // Lost target, go back to wandering
                        zombie.state = 'wandering';
                        zombie.target = null;
                        zombie.wanderTarget = this.getRandomPositionInWorld();
                    }
                    break;
                    
                case 'attacking':
                    // Make sure target still exists
                    if (zombie.target && this.isPlayerAlive(zombie.target)) {
                        const targetPosition = this.getPlayerPosition(zombie.target);
                        const distToTarget = this.distanceBetween(
                            zombie.position.x, zombie.position.z,
                            targetPosition.x, targetPosition.z
                        );
                        
                        // Attack if in range, otherwise chase
                        if (distToTarget <= zombie.attackRange) {
                            this.attackPlayer(zombie, zombie.target);
                        } else {
                            zombie.state = 'chasing';
                        }
                    } else {
                        // Lost target, go back to wandering
                        zombie.state = 'wandering';
                        zombie.target = null;
                        zombie.wanderTarget = this.getRandomPositionInWorld();
                    }
                    break;
            }
            
            // Update zombie mesh position
            zombie.mesh.position.set(zombie.position.x, zombie.position.y, zombie.position.z);
            
            // Broadcast zombie position update
            if (this.isHost()) {
                this.broadcastZombiePosition(zombie);
            }
        }
    }

    updateZombieAI(zombie, deltaTime) {
        // If currently not chasing or already has a target, check for new targets periodically
        if (zombie.state !== 'chasing' || !zombie.target) {
            // Find nearest player in detection range
            let nearestPlayer = null;
            let nearestDistance = Infinity;
            
            // Check local player
            const distToPlayer = this.distanceBetween(
                zombie.position.x, zombie.position.z,
                this.player.position.x, this.player.position.z
            );
            
            if (distToPlayer < zombie.detectionRange) {
                nearestPlayer = this.player.id;
                nearestDistance = distToPlayer;
            }
            
            // Check other players
            for (const clientId in this.peers) {
                if (this.peers[clientId].mesh) {
                    const peerPosition = this.peers[clientId].mesh.position;
                    const distToPeer = this.distanceBetween(
                        zombie.position.x, zombie.position.z,
                        peerPosition.x, peerPosition.z
                    );
                    
                    if (distToPeer < zombie.detectionRange && distToPeer < nearestDistance) {
                        nearestPlayer = clientId;
                        nearestDistance = distToPeer;
                    }
                }
            }
            
            // If found a player in range, start chasing
            if (nearestPlayer) {
                zombie.target = nearestPlayer;
                zombie.state = 'chasing';
            }
        }
    }

    moveZombieTowardsTarget(zombie, target, speed, deltaTime) {
        const directionX = target.x - zombie.position.x;
        const directionZ = target.z - zombie.position.z;
        const distance = Math.sqrt(directionX * directionX + directionZ * directionZ);
        
        if (distance > 0.1) {
            // Normalize direction and apply speed
            zombie.position.x += (directionX / distance) * speed * deltaTime;
            zombie.position.z += (directionZ / distance) * speed * deltaTime;
            
            // Make zombie face movement direction
            const angle = Math.atan2(directionX, directionZ);
            zombie.mesh.rotation.y = angle;
        }
    }

    attackPlayer(zombie, targetId) {
        // Only the host should calculate and broadcast damage
        if (!this.isHost()) return;
        
        // Add attack cooldown to prevent continuous damage
        if (!zombie.lastAttackTime || (this.clock.elapsedTime - zombie.lastAttackTime) > 1) {
            zombie.lastAttackTime = this.clock.elapsedTime;
            
            // Apply damage to local player if it's the target
            if (targetId === this.player.id) {
                this.player.health -= zombie.damage;
                this.player.health = Math.max(0, this.player.health);
                
                // Check if player died
                if (this.player.health <= 0) {
                    this.killPlayer();
                }
                
                // Broadcast updated player status
                this.broadcastPlayerStatus();
            } else {
                // Send attack message to target player
                this.multiplayer.send({
                    type: "zombieAttack",
                    targetId: targetId,
                    damage: zombie.damage,
                    zombieId: zombie.id
                });
            }
        }
    }

    broadcastZombiePosition(zombie) {
        // Only broadcast every few frames to reduce network traffic
        if (this.clock.elapsedTime % 0.5 < 0.01) {
            this.multiplayer.send({
                type: "zombieMove",
                zombieId: zombie.id,
                position: {
                    x: zombie.position.x,
                    y: zombie.position.y,
                    z: zombie.position.z
                },
                state: zombie.state,
                target: zombie.target
            });
        }
    }

    updateZombiePosition(zombieId, position) {
        const zombie = this.world.zombies.find(z => z.id === zombieId);
        if (zombie) {
            // Smooth position update to prevent jittering
            zombie.position.x = 0.7 * zombie.position.x + 0.3 * position.x;
            zombie.position.y = 0.7 * zombie.position.y + 0.3 * position.y;
            zombie.position.z = 0.7 * zombie.position.z + 0.3 * position.z;
        }
    }

    isHost() {
        // Simple host determination - first connected player is the host
        // In a real game, you'd want a more robust host migration system
        const peerIds = Object.keys(this.peers);
        peerIds.push(this.player.id);
        peerIds.sort();
        return peerIds[0] === this.player.id;
    }

    isPlayerAlive(playerId) {
        if (playerId === this.player.id) {
            return this.player.health > 0;
        } else if (this.peers[playerId]) {
            return this.peers[playerId].health > 0;
        }
        return false;
    }

    getPlayerPosition(playerId) {
        if (playerId === this.player.id) {
            return {
                x: this.player.position.x,
                y: this.player.position.y,
                z: this.player.position.z
            };
        } else if (this.peers[playerId] && this.peers[playerId].mesh) {
            const mesh = this.peers[playerId].mesh;
            return {
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z
            };
        }
        // Default to a position far away if player not found
        return { x: 9999, y: 0, z: 9999 };
    }

    distanceBetween(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    removeWorldItem(itemId) {
        const itemIndex = this.world.items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            const item = this.world.items[itemIndex];
            // Remove from scene
            if (item.mesh) {
                this.scene.remove(item.mesh);
            }
            // Remove from world items array
            this.world.items.splice(itemIndex, 1);
        }
    }

    getRandomPositionInWorld() {
        // Get random position within world boundaries
        const halfWidth = this.world.boundaries.width / 2;
        const halfHeight = this.world.boundaries.height / 2;
        
        return {
            x: Math.random() * this.world.boundaries.width - halfWidth,
            y: 0,
            z: Math.random() * this.world.boundaries.height - halfHeight
        };
    }

    spawnLoot() {
        // Check all loot locations for respawn
        const currentTime = this.clock.elapsedTime;
        
        for (const location of this.world.lootLocations) {
            if (
                currentTime - location.lastSpawn > location.respawnTime &&
                Math.random() < 0.01 // Small chance to spawn each update
            ) {
                this.spawnItemAtLocation(location);
            }
        }
    }

    spawn() {
        // Spawn player in a random safe location
        const spawnPosition = this.getRandomPositionInWorld();
        this.player.position.set(spawnPosition.x, 1, spawnPosition.z);
        
        // Create player mesh
        this.playerMesh = new THREE.Mesh(this.geometries.player, this.materials.player);
        this.playerMesh.position.copy(this.player.position);
        this.playerMesh.castShadow = true;
        this.playerMesh.receiveShadow = true;
        this.scene.add(this.playerMesh);
        
        // Set the camera to follow the player
        this.cameraContainer.position.copy(this.player.position);
        
        // Ensure camera rotation reset
        this.camera.rotation.set(0, 0, 0);
        
        // Reset player stats
        this.player.health = 100;
        this.player.hunger = 100;
        this.player.thirst = 100;
        this.player.stamina = 100;
        
        // Reset inventory (if respawning)
        this.player.inventory = [];
        
        // Add basic starting items
        this.addItemToInventory({
            type: 'food',
            quantity: 2,
            name: 'Canned Beans'
        });
        
        this.addItemToInventory({
            type: 'water',
            quantity: 2,
            name: 'Water Bottle'
        });
        
        this.addItemToInventory({
            type: 'weapon',
            quantity: 1,
            name: 'Flashlight'
        });
        
        // Update UI
        this.updateInventoryUI();
    }

    addItemToInventory(item) {
        // Check if similar item exists and can be stacked
        const existingItem = this.player.inventory.find(i => 
            i.type === item.type && i.name === item.name && ['food', 'water', 'ammo'].includes(i.type)
        );
        
        if (existingItem) {
            existingItem.quantity += item.quantity;
        } else {
            // Add as new item if inventory has space
            if (this.player.inventory.length < 20) {
                this.player.inventory.push(item);
            } else {
                console.log("Inventory is full");
                return false;
            }
        }
        
        // Update UI
        this.updateInventoryUI();
        return true;
    }

    updateInventoryUI() {
        // This function will be overridden by the UI.jsx component
        // We dispatch a custom event that the UI component can listen for
        const event = new CustomEvent('inventoryUpdated', {
            detail: { inventory: this.player.inventory }
        });
        window.dispatchEvent(event);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = "0";
        setTimeout(() => {
            loadingScreen.style.display = "none";
            this.gameState.isLoading = false;
            this.gameState.isPlaying = true;
        }, 1000);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handlePlayerMovement(deltaTime) {
        if (this.gameState.isPaused) return;
        
        const moveSpeed = this.player.isRunning ? 5 : 2.5;
        let isMoving = false;
        
        // Movement based on focus (mouse click)
        if (this.inputController.mouse.isDragging && this.inputController.mouse.movementTarget) {
            // Calculate direction to target
            const target = this.inputController.mouse.movementTarget;
            const directionX = target.x - this.player.position.x;
            const directionZ = target.z - this.player.position.z;
            const distance = Math.sqrt(directionX * directionX + directionZ * directionZ);
            
            // Move if not already at target (within a small threshold)
            if (distance > 0.5) {
                isMoving = true;
                
                // Normalize direction and apply speed
                const moveX = (directionX / distance) * moveSpeed * deltaTime;
                const moveZ = (directionZ / distance) * moveSpeed * deltaTime;
                
                // Calculate final position
                const newX = this.player.position.x + moveX;
                const newZ = this.player.position.z + moveZ;
                
                // Update player rotation to face movement direction
                this.player.rotation = Math.atan2(directionX, directionZ);
                
                // Update both player model and camera container rotation
                this.cameraContainer.rotation.y = this.player.rotation;
                this.playerMesh.rotation.y = this.player.rotation;
                
                // Check collision before moving
                if (!this.checkCollision(newX, this.player.position.y, newZ)) {
                    this.player.position.x = newX;
                    this.player.position.z = newZ;
                    
                    // Update camera and player mesh position
                    this.cameraContainer.position.x = this.player.position.x;
                    this.cameraContainer.position.z = this.player.position.z;
                    this.playerMesh.position.copy(this.player.position);
                }
            } else {
                // We've reached the target, stop moving
                this.inputController.mouse.isDragging = false;
            }
        }
        
        // Toggle running with Shift key
        this.player.isRunning = this.inputController.keys['ShiftLeft'] && isMoving && this.player.stamina > 0;
        
        if (isMoving && this.player.isRunning) {
            this.player.stamina -= 10 * deltaTime;
            this.player.stamina = Math.max(0, this.player.stamina);
        }
        
        // Regenerate stamina when not running
        if (!this.player.isRunning && this.player.stamina < 100) {
            this.player.stamina += 5 * deltaTime;
            this.player.stamina = Math.min(100, this.player.stamina);
        }
        
        // Update hunger and thirst over time
        this.player.hunger -= 0.5 * deltaTime;
        this.player.thirst -= 0.8 * deltaTime;
        
        this.player.hunger = Math.max(0, this.player.hunger);
        this.player.thirst = Math.max(0, this.player.thirst);
        
        // Apply effects of hunger and thirst
        if (this.player.hunger <= 0 || this.player.thirst <= 0) {
            this.player.health -= 1 * deltaTime;
            this.player.health = Math.max(0, this.player.health);
            
            if (this.player.health <= 0) {
                this.killPlayer();
            }
        }
        
        // Broadcast player movement and status
        if (isMoving || this.clock.elapsedTime % 2 < 0.01) {
            this.broadcastPlayerPosition();
            this.broadcastPlayerStatus();
        }
    }

    checkCollision(x, y, z) {
        // Simple collision detection with world objects
        for (const object of this.world.objects) {
            if (object.type === 'building') {
                const building = object.mesh;
                const halfSize = 2.5; // Half size of building
                
                if (
                    x > building.position.x - halfSize && x < building.position.x + halfSize &&
                    z > building.position.z - halfSize && z < building.position.z + halfSize
                ) {
                    return true;
                }
            }
            
            if (object.type === 'tree') {
                const trunk = object.trunk;
                const distance = this.distanceBetween(
                    x, z,
                    trunk.position.x, trunk.position.z
                );
                
                if (distance < 1) {
                    return true;
                }
            }
        }
        
        return false;
    }

    broadcastPlayerPosition() {
        this.multiplayer.send({
            type: "playerMove",
            position: {
                x: this.player.position.x,
                y: this.player.position.y,
                z: this.player.position.z
            },
            rotation: this.player.rotation
        });
    }

    broadcastPlayerStatus() {
        this.multiplayer.send({
            type: "playerStatus",
            health: this.player.health,
            hunger: this.player.hunger,
            thirst: this.player.thirst
        });
    }

    updatePeerPosition(clientId, position, rotation) {
        if (!this.peers[clientId]) {
            this.peers[clientId] = {
                username: this.multiplayer.party.peers[clientId]?.username || 'Unknown',
                health: 100,
                hunger: 100,
                thirst: 100
            };
        }
        
        // Create mesh for peer if it doesn't exist
        if (!this.peers[clientId].mesh) {
            const peerMesh = new THREE.Mesh(this.geometries.player, this.materials.player);
            peerMesh.castShadow = true;
            peerMesh.receiveShadow = true;
            this.scene.add(peerMesh);
            this.peers[clientId].mesh = peerMesh;
        }
        
        // Smooth position and rotation update
        const mesh = this.peers[clientId].mesh;
        mesh.position.x = 0.9 * mesh.position.x + 0.1 * position.x;
        mesh.position.y = 0.9 * mesh.position.y + 0.1 * position.y;
        mesh.position.z = 0.9 * mesh.position.z + 0.1 * position.z;
        mesh.rotation.y = 0.9 * mesh.rotation.y + 0.1 * rotation;
    }

    updatePeerStatus(clientId, health, hunger, thirst) {
        if (this.peers[clientId]) {
            this.peers[clientId].health = health;
            this.peers[clientId].hunger = hunger;
            this.peers[clientId].thirst = thirst;
        }
    }

    removePlayer(clientId) {
        if (this.peers[clientId] && this.peers[clientId].mesh) {
            this.scene.remove(this.peers[clientId].mesh);
        }
        delete this.peers[clientId];
    }

    sendChatMessage(message) {
        if (!message.trim()) return;
        
        this.multiplayer.send({
            type: "chatMessage",
            message: message.trim()
        });
        
        // Add to local chat messages
        this.addChatMessage(this.player.username, message.trim());
    }

    addChatMessage(username, message) {
        this.chatMessages.push({
            username,
            message,
            timestamp: new Date().toLocaleTimeString()
        });
        
        // Keep only last 50 messages
        if (this.chatMessages.length > 50) {
            this.chatMessages.shift();
        }
        
        // Update UI
        this.updateChatUI();
    }

    addSystemMessage(message) {
        this.chatMessages.push({
            username: 'SYSTEM',
            message,
            timestamp: new Date().toLocaleTimeString(),
            isSystem: true
        });
        
        // Keep only last 50 messages
        if (this.chatMessages.length > 50) {
            this.chatMessages.shift();
        }
        
        // Update UI
        this.updateChatUI();
    }

    updateChatUI() {
        // Dispatch event for UI component
        const event = new CustomEvent('chatUpdated', {
            detail: { messages: this.chatMessages }
        });
        window.dispatchEvent(event);
    }

    updatePlayerList() {
        // Dispatch event for UI component
        const event = new CustomEvent('playerListUpdated', {
            detail: { 
                players: {
                    ...this.peers,
                    [this.player.id]: {
                        username: this.player.username,
                        health: this.player.health,
                        isLocal: true
                    }
                } 
            }
        });
        window.dispatchEvent(event);
    }

    togglePauseMenu() {
        this.gameState.isPaused = !this.gameState.isPaused;
        
        // Dispatch event for UI component
        const event = new CustomEvent('gameStateChanged', {
            detail: { isPaused: this.gameState.isPaused }
        });
        window.dispatchEvent(event);
        
        // Handle pointer lock
        if (this.gameState.isPaused) {
            document.exitPointerLock();
        }
    }

    handlePlayerAction() {
        if (this.gameState.isPaused) return;
        
        // Cast a ray from camera to detect interactive objects
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check if we hit any items
        const itemMeshes = this.world.items.map(item => item.mesh);
        const intersects = raycaster.intersectObjects(itemMeshes);
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const item = this.world.items.find(item => item.mesh === hitMesh);
            
            if (item) {
                // Pick up the item
                if (this.addItemToInventory({
                    type: item.type,
                    quantity: item.quantity,
                    name: this.getItemName(item.type)
                })) {
                    // Broadcast that item was picked up
                    this.multiplayer.send({
                        type: "itemPickup",
                        itemId: item.id
                    });
                    
                    // Remove from world
                    this.removeWorldItem(item.id);
                }
            }
        }
        
        // Check for zombie hits
        const zombieMeshes = this.world.zombies.map(zombie => zombie.mesh);
        const zombieIntersects = raycaster.intersectObjects(zombieMeshes);
        
        if (zombieIntersects.length > 0 && this.player.equippedItem) {
            const hitMesh = zombieIntersects[0].object;
            const zombie = this.world.zombies.find(zombie => zombie.mesh === hitMesh);
            
            if (zombie) {
                // Attack the zombie
                this.attackZombie(zombie);
            }
        }
    }

    getItemName(type) {
        // Return a sensible name based on item type
        const itemNames = {
            'food': ['Canned Beans', 'Cereal', 'Dried Meat', 'MRE', 'Chocolate Bar'],
            'water': ['Water Bottle', 'Canteen', 'Soda'],
            'medicine': ['Bandage', 'Painkillers', 'Antibiotics', 'First Aid Kit'],
            'weapon': ['Pistol', 'Rifle', 'Axe', 'Baseball Bat', 'Knife'],
            'ammo': ['Pistol Ammo', 'Rifle Ammo', 'Shotgun Shells'],
            'tool': ['Flashlight', 'Compass', 'Rope', 'Map', 'Lighter']
        };
        
        const options = itemNames[type] || ['Unknown Item'];
        return options[Math.floor(Math.random() * options.length)];
    }

    attackZombie(zombie) {
        // Determine damage based on equipped weapon
        let damage = 10; // Default unarmed damage
        
        if (this.player.equippedItem) {
            if (this.player.equippedItem.type === 'weapon') {
                // Different weapons do different damage
                if (this.player.equippedItem.name.includes('Pistol')) {
                    damage = 30;
                } else if (this.player.equippedItem.name.includes('Rifle')) {
                    damage = 50;
                } else if (this.player.equippedItem.name.includes('Axe')) {
                    damage = 40;
                } else if (this.player.equippedItem.name.includes('Bat')) {
                    damage = 25;
                } else if (this.player.equippedItem.name.includes('Knife')) {
                    damage = 20;
                }
            }
        }
        
        // Apply damage to zombie
        zombie.health -= damage;
        
        // Check if zombie died
        if (zombie.health <= 0) {
            // Remove zombie
            this.scene.remove(zombie.mesh);
            const index = this.world.zombies.indexOf(zombie);
            if (index !== -1) {
                this.world.zombies.splice(index, 1);
            }
            
            // Chance to drop loot
            if (Math.random() < 0.3) {
                this.spawnItemAtLocation({
                    position: {
                        x: zombie.position.x,
                        y: 0,
                        z: zombie.position.z
                    },
                    type: 'zombie',
                    lastSpawn: 0
                });
            }
            
            // Broadcast zombie death
            if (this.isHost()) {
                this.multiplayer.send({
                    type: "zombieDeath",
                    zombieId: zombie.id
                });
            }
        } else {
            // Broadcast zombie hit
            if (this.isHost()) {
                this.multiplayer.send({
                    type: "zombieHit",
                    zombieId: zombie.id,
                    health: zombie.health
                });
            }
        }
    }

    handlePeerAction(clientId, action, targetId) {
        // Handle actions performed by other players
        switch(action) {
            case 'attack':
                // Update zombie health if we're the host
                if (this.isHost()) {
                    const zombie = this.world.zombies.find(z => z.id === targetId);
                    if (zombie) {
                        zombie.health -= 10; // Default damage
                        
                        if (zombie.health <= 0) {
                            // Remove zombie
                            this.scene.remove(zombie.mesh);
                            const index = this.world.zombies.indexOf(zombie);
                            if (index !== -1) {
                                this.world.zombies.splice(index, 1);
                            }
                            
                            // Broadcast zombie death
                            this.multiplayer.send({
                                type: "zombieDeath",
                                zombieId: zombie.id
                            });
                        } else {
                            // Broadcast zombie hit
                            this.multiplayer.send({
                                type: "zombieHit",
                                zombieId: zombie.id,
                                health: zombie.health
                            });
                        }
                    }
                }
                break;
        }
    }

    killPlayer() {
        this.addSystemMessage("You have died!");
        
        // Show respawn screen
        // This will be handled by the UI component
        const event = new CustomEvent('playerDied');
        window.dispatchEvent(event);
    }

    respawnPlayer() {
        // Reset player state and respawn
        this.spawn();
        
        // Notify UI that player has respawned
        const event = new CustomEvent('playerRespawned');
        window.dispatchEvent(event);
    }

    updateDayNightCycle(deltaTime) {
        // Update time of day (24-hour cycle)
        // 1 real second = 1 minute in game
        this.gameState.timeOfDay += (1/60) * deltaTime;
        if (this.gameState.timeOfDay >= 24) {
            this.gameState.timeOfDay -= 24;
        }
        
        // Calculate sun position and lighting based on time of day
        const dayProgress = (this.gameState.timeOfDay - 6) / 12; // 0 at 6AM, 1 at 6PM
        
        // Night time between 7PM and 5AM
        this.gameState.isNight = this.gameState.timeOfDay < 5 || this.gameState.timeOfDay > 19;
        
        // Update lighting
        if (!this.gameState.isNight) {
            // Daytime
            const sunAngle = Math.PI * dayProgress;
            const sunHeight = Math.sin(sunAngle);
            const sunX = Math.cos(sunAngle) * 100;
            
            this.sunlight.position.set(sunX, 100 * sunHeight, 0);
            this.sunlight.intensity = 0.5 + 0.5 * sunHeight;
            
            // Sky color based on time of day
            let skyColor;
            if (this.gameState.timeOfDay < 8) {
                // Dawn - bluish to light blue
                const dawn = (this.gameState.timeOfDay - 5) / 3;
                skyColor = new THREE.Color(0.7 + 0.3 * dawn, 0.7 + 0.3 * dawn, 0.9 + 0.1 * dawn);
            } else if (this.gameState.timeOfDay > 17) {
                // Dusk - light blue to orange to deep blue
                const dusk = (this.gameState.timeOfDay - 17) / 2;
                skyColor = new THREE.Color(0.9 - 0.5 * dusk, 0.7 - 0.5 * dusk, 0.5);
            } else {
                // Full day - light blue
                skyColor = new THREE.Color(0x87CEEB);
            }
            
            this.scene.background = skyColor;
            this.scene.fog.color = skyColor;
        } else {
            // Nighttime
            this.sunlight.intensity = 0.1;
            this.scene.background = new THREE.Color(0x0A1030); // Dark blue for night
            this.scene.fog.color = new THREE.Color(0x0A1030);
        }
        
        // Update UI with time
        this.updateTimeUI();
    }

    updateTimeUI() {
        // Convert 24-hour time to 12-hour format with AM/PM
        let hour = Math.floor(this.gameState.timeOfDay);
        let minute = Math.floor((this.gameState.timeOfDay % 1) * 60);
        const period = hour >= 12 ? 'PM' : 'AM';
        
        hour = hour % 12;
        hour = hour ? hour : 12; // Convert 0 to 12
        
        // Format time as HH:MM AM/PM
        const formattedTime = `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
        
        // Dispatch event for UI component
        const event = new CustomEvent('timeUpdated', {
            detail: { 
                time: formattedTime,
                isNight: this.gameState.isNight
            }
        });
        window.dispatchEvent(event);
    }

    updateCompass() {
        // Get player's facing direction in degrees
        const directionDegrees = (this.player.rotation * (180 / Math.PI)) % 360;
        let compassDirection = '';
        
        // Convert to compass direction
        if (directionDegrees >= -22.5 && directionDegrees < 22.5) {
            compassDirection = 'N';
        } else if (directionDegrees >= 22.5 && directionDegrees < 67.5) {
            compassDirection = 'NE';
        } else if (directionDegrees >= 67.5 && directionDegrees < 112.5) {
            compassDirection = 'E';
        } else if (directionDegrees >= 112.5 && directionDegrees < 157.5) {
            compassDirection = 'SE';
        } else if (directionDegrees >= 157.5 || directionDegrees < -157.5) {
            compassDirection = 'S';
        } else if (directionDegrees >= -157.5 && directionDegrees < -112.5) {
            compassDirection = 'SW';
        } else if (directionDegrees >= -112.5 && directionDegrees < -67.5) {
            compassDirection = 'W';
        } else if (directionDegrees >= -67.5 && directionDegrees < -22.5) {
            compassDirection = 'NW';
        }
        
        // Dispatch event for UI component
        const event = new CustomEvent('compassUpdated', {
            detail: { 
                direction: compassDirection,
                degrees: directionDegrees
            }
        });
        window.dispatchEvent(event);
    }

    getMouseWorldPosition() {
        // Create a ray from the camera through the mouse position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(this.inputController.mouse.x, this.inputController.mouse.y), this.camera);
        
        // Calculate intersection with the ground plane
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, target);
        
        return target;
    }

    updateMoveCountdown(deltaTime) {
        if (this.inputController.mouse.moveCountdown > 0) {
            // Update countdown based on elapsed time
            const elapsedTime = this.clock.elapsedTime - this.inputController.mouse.moveClickStart;
            const remainingTime = 3 - elapsedTime;
            
            // Update the countdown display
            const indicator = document.getElementById('move-countdown-indicator');
            if (indicator) {
                // Display current countdown number (3, 2, 1)
                const countdownValue = Math.ceil(remainingTime);
                indicator.innerText = countdownValue > 0 ? countdownValue.toString() : '';
            }
            
            // Check if countdown is complete
            if (remainingTime <= 0) {
                // Initiate movement
                this.inputController.mouse.isDown = true;
                this.inputController.mouse.isDragging = true;
                this.inputController.mouse.movementTarget = this.getMouseWorldPosition();
                
                // Reset countdown
                this.inputController.mouse.moveCountdown = 0;
                this.inputController.mouse.moveClickStart = null;
                this.inputController.mouse.moveClickPosition = null;
                
                // Remove indicator
                if (indicator) {
                    document.body.removeChild(indicator);
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        if (!this.gameState.isPlaying) return;
        
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);
        
        if (!this.gameState.isPaused) {
            // Update movement countdown
            this.updateMoveCountdown(deltaTime);
            
            // Update player movement
            this.handlePlayerMovement(deltaTime);
            
            // Update zombies
            this.updateZombies(deltaTime);
            
            // Spawn loot
            this.spawnLoot();
            
            // Update day/night cycle
            this.updateDayNightCycle(deltaTime);
            
            // Update compass
            this.updateCompass();
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new BrowserDayZ();
    // Make game globally accessible for debugging and UI interaction
    window.game = game;
    game.init();
});