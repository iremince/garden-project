const app = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    mouse: new THREE.Vector2(),
    clock: new THREE.Clock(),
    rain: null,
    rainVelocity: null,
    isRaining: false,
    weatherTimeout: null,
    modelsToLoad: 4, // garden, flower1, flower2, flower3
    modelsLoaded: 0,
    flowerModels: {},
    plantedFlowers: [],
    grassPatches: [],
    selectedFlowerType: 'flower1',
    selectedWorkTime: 30,
    gardenLoaded: false,
    workData: {
        sessions: []
    },
    selectedSoilSpot: null,
    clickedPosition: null,
    statsChart: null,

    init: function() {
        this.initScene();
        this.loadData();
        this.loadModels();
        this.animate();
        this.setupUI();
    },

    initScene: function() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(8, 12, 15);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(this.renderer.domElement);

        // Automatic Day/Night Cycle Logic
        const currentHour = new Date().getHours();
        const isNight = currentHour >= 19 || currentHour < 6;

        if (isNight) {
            // Night Scene
            this.scene.background = new THREE.Color(0x0B1D36);
            const ambientLight = new THREE.AmbientLight(0xB97C20, 0.2);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xE8E4D5, 0.3); // Moonlight
            directionalLight.position.set(10, 20, 10);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);
            const hemisphereLight = new THREE.HemisphereLight(0x000000, 0x080820, 0.8);
            this.scene.add(hemisphereLight);
        } else {
            // Day Scene (our previous well-tuned setup)
            this.scene.background = new THREE.Color("#c9e9f6");
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xFFFAF0, 0.7);
            directionalLight.position.set(10, 20, 10);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);
            const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.6);
            this.scene.add(hemisphereLight);
        }

        // Common settings for shadows and controls
        this.scene.traverse(node => {
            if (node instanceof THREE.DirectionalLight) {
                node.shadow.mapSize.width = 2048;
                node.shadow.mapSize.height = 2048;
                node.shadow.camera.near = 0.5;
                node.shadow.camera.far = 50;
                node.shadow.camera.left = -20;
                node.shadow.camera.right = 20;
                node.shadow.camera.top = 20;
                node.shadow.camera.bottom = -20;
            }
        });

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.raycaster = new THREE.Raycaster();
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));

        this.createRainSystem();
    },

    createRainSystem: function() {
        const rainCount = 4000; // Reduced from 10000
        const positions = new Float32Array(rainCount * 3);
        this.rainVelocity = new Float32Array(rainCount);

        for (let i = 0; i < rainCount; i++) {
            positions[i * 3] = Math.random() * 50 - 25; // x
            positions[i * 3 + 1] = Math.random() * 40 + 10; // y (start high)
            positions[i * 3 + 2] = Math.random() * 50 - 25; // z
            this.rainVelocity[i] = Math.random() * 0.5 + 0.4; // Increased speed
        }

        const rainGeo = new THREE.BufferGeometry();
        rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const currentHour = new Date().getHours();
        const isNight = currentHour >= 19 || currentHour < 6;
        const rainColor = isNight ? 0xADD8E6 : 0x607D8B; // Light blue for night, grey-blue for day

        const rainMaterial = new THREE.PointsMaterial({
            color: rainColor,
            size: 0.05, // Made smaller
            transparent: true,
            opacity: 0.5 // Made more transparent
        });

        this.rain = new THREE.Points(rainGeo, rainMaterial);
        this.rain.visible = false; // Initially hidden
        this.scene.add(this.rain);
    },

    onModelLoaded: function() {
        this.modelsLoaded++;
        if (this.modelsLoaded === this.modelsToLoad) {
            console.log('All models loaded, populating garden...');
            this.gardenLoaded = true;
            this.loadSavedFlowers();
            this.showMessage('Every flower begins with a choice');
        }
    },

    loadModels: function() {
        const loader = new THREE.GLTFLoader();
        const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7, metalness: 0.1 });
        const pinkPetalMaterial = new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.6, metalness: 0.1 });
        const yellowCenterMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFACD, roughness: 0.5, metalness: 0.1 });
        const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xEAEAEA, roughness: 0.5, metalness: 0.1 });
        const blueMaterial = new THREE.MeshStandardMaterial({ color: 0x2196F3, roughness: 0.6, metalness: 0.1 });
        const lightBlueMaterial = new THREE.MeshStandardMaterial({ color: 0x64B5F6, roughness: 0.6, metalness: 0.1 });
        const lightestBlueMaterial = new THREE.MeshStandardMaterial({ color: 0xBBDEFB, roughness: 0.6, metalness: 0.1 });
        const lightYellowMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF59D, roughness: 0.5, metalness: 0.1 });
        
        loader.load('./model/gardenn.glb', (gltf) => {
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = 0.8;
                        child.material.metalness = 0.2;
                        const meshName = child.name ? child.name.toLowerCase() : '';
                        if (meshName.includes('fence')) { child.material.color.set("#610000"); }
                        else if (meshName.includes('grass')) {
                            child.material.color.set("#4CAF50");
                            this.grassPatches.push(child);
                        }
                        else if (meshName.includes('soil')) {
                            child.userData.isSoil = true;
                            child.userData.hasFlower = false;
                            child.material.color.set("#A87F70");
                        }
                        else if (meshName.includes('ground')) { child.material.color.set("#e0ba9f"); }
                    }
                }
            });
            this.scene.add(gltf.scene);
            this.onModelLoaded();
        }, undefined, () => { this.createFallbackScene(); this.onModelLoaded(); });

        loader.load('./model/flower1.glb', (gltf) => {
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    const name = child.name || '';
                    if (name.startsWith('stem')) child.material = stemMaterial;
                    else if (name.startsWith('petal_pink')) child.material = pinkPetalMaterial;
                    else if (name.startsWith('center_yellow')) child.material = yellowCenterMaterial;
                    else if (name.startsWith('white')) child.material = whiteMaterial;
                    child.castShadow = true;
                }
            });
            this.flowerModels['flower1'] = gltf.scene;
            this.onModelLoaded();
        }, undefined, () => { this.createFallbackFlower('flower1'); this.onModelLoaded(); });

        loader.load('./model/flower2.glb', (gltf) => {
            const model = gltf.scene;
            model.traverse(child => {
                if (child.isMesh) {
                    const name = child.name || '';
                    if (name.startsWith('stem')) child.material = stemMaterial;
                    else if (name.startsWith('petal_white')) child.material = whiteMaterial;
                    child.castShadow = true;
                }
            });
            const wrapper = new THREE.Group();
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            wrapper.add(model);
            model.position.x -= center.x;
            model.position.y -= box.min.y;
            model.position.z -= center.z;
            this.flowerModels['flower2'] = wrapper;
            this.onModelLoaded();
        }, undefined, () => { this.createFallbackFlower('flower2'); this.onModelLoaded(); });

        // Flower 3 Model
        loader.load('./model/flower3.glb', (gltf) => {
            console.log('✅ Flower 3 model loaded');
            const model = gltf.scene;
            model.traverse(child => {
                if (child.isMesh) {
                    const name = child.name || '';
                    if (name.startsWith('leaf3')) child.material = lightestBlueMaterial;
                    else if (name.startsWith('leaf2')) child.material = lightBlueMaterial;
                    else if (name.startsWith('leaf')) child.material = blueMaterial;
                    else if (name.startsWith('center')) child.material = lightYellowMaterial;
                    else if (name.startsWith('o')) child.material = lightYellowMaterial;
                    else if (name.startsWith('stem')) child.material = stemMaterial;
                    child.castShadow = true;
                }
            });

            // Correct the pivot point
            const wrapper = new THREE.Group();
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            wrapper.add(model);
            model.position.x -= center.x;
            model.position.y -= box.min.y;
            model.position.z -= center.z;

            this.flowerModels['flower3'] = wrapper;
            this.onModelLoaded();
        }, undefined, (error) => {
            console.error('Error loading flower3:', error);
            // We don't have a fallback for flower3, so we'll just log the error
            // and still count the model as "loaded" to not break the app.
            this.onModelLoaded();
        });
    },

    loadSavedFlowers: function() {
        if (!this.workData || !this.workData.sessions) return;

        const soilObjects = [];
        this.scene.traverse(child => {
            if (child.userData && child.userData.isSoil) soilObjects.push(child);
        });

        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        this.workData.sessions.forEach(session => {
            if (!session.position || !this.flowerModels[session.flowerType]) return;

            const sessionDate = new Date(session.date);
            const isToday = sessionDate.getFullYear() === todayYear &&
                            sessionDate.getMonth() === todayMonth &&
                            sessionDate.getDate() === todayDate;

            // Only load flowers planted today
            if (isToday) {
                const flower = this.flowerModels[session.flowerType].clone();
                const position = new THREE.Vector3(session.position.x, session.position.y, session.position.z);
                flower.position.copy(position);
                flower.rotation.y = Math.random() * Math.PI * 2;
                flower.scale.set(0.15, 0.15, 0.15);
                flower.userData.sessionInfo = session;
                this.scene.add(flower);
                this.plantedFlowers.push(flower);

                // Mark the corresponding soil spot as occupied
                for (const soil of soilObjects) {
                    const box = new THREE.Box3().setFromObject(soil);
                    if (box.containsPoint(position)) {
                        soil.userData.hasFlower = true;
                        break;
                    }
                }
            }
        });
    },

    createFallbackFlower: function(type) {
        // ...
    },

    createFallbackScene: function() {
        // ...
    },

    onCanvasClick: function(event) {
        if (!this.gardenLoaded) { this.showMessage('The garden is not loaded yet, please wait...'); return; }
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const flowerIntersects = this.raycaster.intersectObjects(this.plantedFlowers, true);
        if (flowerIntersects.length > 0) {
            let clickedObject = flowerIntersects[0].object;
            while (clickedObject.parent && !clickedObject.userData.sessionInfo) { clickedObject = clickedObject.parent; }
            if (clickedObject.userData.sessionInfo) { this.showFlowerDetails(clickedObject.userData.sessionInfo); return; }
        }
        const soilObjects = [];
        this.scene.traverse(child => { if (child.userData.isSoil) soilObjects.push(child); });
        const soilIntersects = this.raycaster.intersectObjects(soilObjects, true);
        if (soilIntersects.length > 0) {
            const soil = soilIntersects[0].object;
            if (!soil.userData.hasFlower) {
                this.selectedSoilSpot = soil;
                this.clickedPosition = soilIntersects[0].point.clone();
                this.showFlowerSelection();
            } else {
                this.showMessage('This spot already has a flower!');
            }
        }
    },

    showFlowerDetails: function(sessionInfo) {
        if (!sessionInfo) return;
        document.getElementById('detail-activity').textContent = sessionInfo.activity;
        document.getElementById('detail-duration').textContent = sessionInfo.workTime;
        const date = new Date(sessionInfo.date);
        document.getElementById('detail-date').textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        document.getElementById('flower-detail-popup').classList.remove('hidden');
    },

    showFlowerSelection: function() {
        document.getElementById('flower-popup').style.display = 'block';
        document.getElementById('activity-input').value = '';

        // Gamification Lock/Unlock Logic - Based on TODAY's work time
        const unlockThreshold = 300; // 5 hours in minutes

        const today = new Date();
        const todaysSessions = this.workData.sessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate.getFullYear() === today.getFullYear() &&
                   sessionDate.getMonth() === today.getMonth() &&
                   sessionDate.getDate() === today.getDate();
        });

        const todaysWorkTime = todaysSessions.reduce((total, session) => total + session.workTime, 0);

        const flower3option = document.querySelector('.flower-option[data-flower="flower3"]');
        if (flower3option) {
            if (todaysWorkTime >= unlockThreshold) {
                flower3option.classList.remove('locked');
                flower3option.title = 'Select this flower';
            } else {
                flower3option.classList.add('locked');
                const remainingTime = unlockThreshold - todaysWorkTime;
                flower3option.title = `Work for ${remainingTime} more minutes today to unlock!`;
            }
        }

        // Reset selections
        document.querySelectorAll('.flower-option').forEach(el => el.classList.remove('selected'));
        document.querySelector('.flower-option[data-flower="flower1"]').classList.add('selected');
        this.selectedFlowerType = 'flower1';
        this.selectedWorkTime = 30;
        document.getElementById('time-display-text').textContent = '30 min';
        document.querySelector('.time-dropdown').style.display = 'none';
        document.getElementById('custom-time-inputs').style.display = 'none';
    },

    confirmPlanting: function() {
        const activity = document.getElementById('activity-input').value.trim();
        if (!activity) { this.showMessage('Please describe what you worked on!'); return; }
        if (this.selectedWorkTime === 0) {
            const hours = parseInt(document.getElementById('custom-hours').value) || 0;
            const minutes = parseInt(document.getElementById('custom-minutes').value) || 0;
            this.selectedWorkTime = (hours * 60) + minutes;
        }
        if (this.selectedWorkTime <= 0) { this.showMessage('Please enter a valid work duration!'); return; }
        const sessionData = { id: Date.now(), flowerType: this.selectedFlowerType, activity: activity, workTime: this.selectedWorkTime, position: this.clickedPosition.clone(), date: new Date().toISOString() };
        const flower = this.flowerModels[this.selectedFlowerType].clone();
        flower.position.copy(this.clickedPosition);
        flower.rotation.y = Math.random() * Math.PI * 2;
        flower.scale.set(0.15, 0.15, 0.15);
        flower.userData.sessionInfo = sessionData;
        this.scene.add(flower);
        this.selectedSoilSpot.userData.hasFlower = true;
        this.plantedFlowers.push(flower);
        this.workData.sessions.push(sessionData);
        this.saveData();
        this.updateStats(this.calculateStats());
        this.renderChart();
        this.showMessage(`Congratulations! A flower for your ${this.selectedWorkTime} minute session has been planted!`);
        document.getElementById('flower-popup').style.display = 'none';
    },

    cancelPlanting: function() {
        document.getElementById('flower-popup').style.display = 'none';
    },

    resetStats: function() {
        if (confirm('Are you sure you want to reset all your statistics? This action cannot be undone.')) {
            localStorage.removeItem('gardenWorkData');
            this.workData.sessions = [];
            this.plantedFlowers.forEach(flower => this.scene.remove(flower));
            this.plantedFlowers = [];
            this.scene.traverse(child => {
                if (child.userData.isSoil) child.userData.hasFlower = false;
            });
            this.updateStats(this.calculateStats());
            this.renderChart();
            this.showMessage('All statistics have been reset.');
        }
    },

    rebuildScene: function() {
        this.plantedFlowers.forEach(flower => this.scene.remove(flower));
        this.plantedFlowers = [];
        this.scene.traverse(child => {
            if (child.userData.isSoil) {
                child.userData.hasFlower = false;
            }
        });
        this.saveData();
        this.loadSavedFlowers();
        this.updateStats(this.calculateStats());
        this.renderChart();
    },

    renderChart: function() {
        if (this.statsChart) { this.statsChart.destroy(); }
        const activePeriod = document.querySelector('.stats-tab-btn.active')?.dataset.period || 'weekly';
        const now = new Date();
        let labels = [];
        let data = [];
        if (activePeriod === 'weekly') {
            labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            data = Array(7).fill(0);
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            this.workData.sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                if (sessionDate >= weekStart) {
                    data[sessionDate.getDay()] += session.workTime;
                }
            });
        } else if (activePeriod === 'monthly') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
            data = Array(daysInMonth).fill(0);
            this.workData.sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                if (sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()) {
                    data[sessionDate.getDate() - 1] += session.workTime;
                }
            });
        } else {
            labels = ['Today'];
            let totalMinutes = 0;
            const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
            this.workData.sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                if (sessionDate >= todayStart) {
                    totalMinutes += session.workTime;
                }
            });
            data = [totalMinutes];
        }
        const ctx = document.getElementById('stats-chart').getContext('2d');
        this.statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutes Worked',
                    data: data,
                    backgroundColor: 'rgba(76, 175, 80, 0.5)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return value + 'm' } } } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return ` ${context.raw} minutes`; } } } }
            }
        });
    },

    calculateStats: function() {
        const stats = { today: { time: 0, flowers: 0, sessions: 0 }, weekly: { time: 0, flowers: 0, sessions: 0 }, monthly: { time: 0, flowers: 0, sessions: 0 } };
        if (!this.workData || !this.workData.sessions) return stats;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.workData.sessions.forEach(session => {
            const sessionDate = new Date(session.date);
            const workTimeInSeconds = session.workTime * 60;
            if (sessionDate >= monthStart) {
                stats.monthly.time += workTimeInSeconds;
                stats.monthly.flowers++;
                stats.monthly.sessions++;
            }
            if (sessionDate >= weekStart) {
                stats.weekly.time += workTimeInSeconds;
                stats.weekly.flowers++;
                stats.weekly.sessions++;
            }
            if (sessionDate >= today) {
                stats.today.time += workTimeInSeconds;
                stats.today.flowers++;
                stats.today.sessions++;
            }
        });
        return stats;
    },

    updateStats: function(stats) {
        const timeEl = document.getElementById('stats-time');
        const flowersEl = document.getElementById('stats-flowers');
        const sessionsEl = document.getElementById('stats-sessions');
        if (timeEl && flowersEl && sessionsEl) {
            const activePeriod = document.querySelector('.stats-tab-btn.active')?.dataset.period || 'today';
            const periodStats = stats[activePeriod];
            timeEl.textContent = this.formatTime(periodStats.time);
            flowersEl.textContent = periodStats.flowers;
            sessionsEl.textContent = periodStats.sessions;
        }
    },

    formatTime: function(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    },

    showMessage: function(text) {
        const msg = document.getElementById('info-message');
        msg.textContent = text;
        msg.style.display = 'block';
        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => { msg.style.display = 'none'; }, 3500);
    },

    onWindowResize: function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    saveData: function() {
        try {
            localStorage.setItem('gardenWorkData', JSON.stringify(this.workData));
        } catch (e) { console.error('Error saving to LocalStorage:', e); }
    },

    loadData: function() {
        try {
            const data = localStorage.getItem('gardenWorkData');
            if (data) {
                this.workData = JSON.parse(data);
                this.workData.sessions.forEach(s => {
                    if (s.position && !(s.position instanceof THREE.Vector3)) {
                        s.position = new THREE.Vector3(s.position.x, s.position.y, s.position.z);
                    }
                });
            }
        } catch (e) { console.error('Error loading from LocalStorage:', e); }
        this.updateStats(this.calculateStats());
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());

        const elapsedTime = this.clock.getElapsedTime();

        // Animate flowers
        this.plantedFlowers.forEach(flower => {
            // Use position to offset the animation, so they don't all sway in unison
            flower.rotation.z = Math.sin(elapsedTime * 1.5 + flower.position.x) * 0.05;
        });

        // Animate grass
        this.grassPatches.forEach(grass => {
            grass.rotation.x = Math.sin(elapsedTime * 1.2 + grass.position.y) * 0.05;
        });

        // Animate rain
        if (this.rain && this.rain.visible) {
            const positions = this.rain.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                // Update y position based on velocity
                positions[i + 1] -= this.rainVelocity[i / 3];

                // Reset raindrop to the top if it falls below the ground
                if (positions[i + 1] < -5) {
                    positions[i + 1] = 40;
                }
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    },

    initWeather: function() {
        clearTimeout(this.weatherTimeout);

        // Schedule the next weather event
        const timeToNextEvent = Math.random() * 240000 + 60000; // 1 to 5 minutes

        this.weatherTimeout = setTimeout(() => {
            // 30% chance of rain
            if (Math.random() < 0.3) {
                this.startRain();
            } else {
                // If no rain, just schedule the next check
                this.initWeather();
            }
        }, timeToNextEvent);
    },

    startRain: function() {
        if (this.isRaining) return;
        console.log("It's starting to rain...");
        this.isRaining = true;
        if (this.rain) {
            this.rain.visible = true;
        }

        // Set a timeout for how long the rain will last
        const rainDuration = Math.random() * 60000 + 30000; // 30 to 90 seconds
        this.weatherTimeout = setTimeout(() => {
            this.stopRain();
        }, rainDuration);
    },

    stopRain: function() {
        if (!this.isRaining) return;
        console.log("The rain is stopping.");
        this.isRaining = false;
        if (this.rain) {
            this.rain.visible = false;
        }
        // Schedule the next weather check
        this.initWeather();
    },

    // This function is for complete removal and cleanup, not just hiding.
    stopRainSystem: function() {
        console.log("Completely stopping and cleaning up rain system.");
        clearTimeout(this.weatherTimeout); // Stop the weather loop
        this.isRaining = false;
        if (this.rain) {
            this.scene.remove(this.rain);
            this.rain.geometry.dispose();
            this.rain.material.dispose();
            this.rain = null;
            this.rainVelocity = null;
        }
    },

    setupUI: function() {
        this.initWeather(); // Start the weather system

        document.querySelectorAll('.flower-option').forEach(el => {
            el.addEventListener('click', () => {
                if (el.classList.contains('locked')) {
                    this.showMessage('This flower is locked. Keep working to unlock it!');
                    return;
                }
                this.selectedFlowerType = el.dataset.flower;
                document.querySelectorAll('.flower-option').forEach(opt => opt.classList.remove('selected'));
                el.classList.add('selected');
            });
        });
        document.querySelector('.time-display').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.querySelector('.time-dropdown');
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            document.querySelector('.time-display-arrow').classList.toggle('expanded', !isVisible);
        });
        document.querySelectorAll('.time-dropdown-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectedWorkTime = Number(option.dataset.minutes);
                if (this.selectedWorkTime === 0) {
                    document.getElementById('time-display-text').textContent = 'Custom...';
                    document.getElementById('custom-time-inputs').style.display = 'flex';
                } else {
                    document.getElementById('time-display-text').textContent = option.textContent;
                    document.getElementById('custom-time-inputs').style.display = 'none';
                }
                document.querySelector('.time-dropdown').style.display = 'none';
                document.querySelector('.time-display-arrow').classList.remove('expanded');
            });
        });
        document.addEventListener('click', (e) => {
            const timeDropdown = document.querySelector('.time-dropdown');
            if (!timeDropdown.contains(e.target) && !document.querySelector('.time-display').contains(e.target)) {
                timeDropdown.style.display = 'none';
                document.querySelector('.time-display-arrow').classList.remove('expanded');
            }
        });
        document.querySelector('.btn-confirm').addEventListener('click', () => this.confirmPlanting());
        document.querySelector('.btn-cancel').addEventListener('click', () => this.cancelPlanting());
        document.getElementById('reset-stats-btn').addEventListener('click', () => this.resetStats());
        document.getElementById('stats-header').addEventListener('click', () => {
            document.getElementById('stats-body').classList.toggle('hidden');
            document.getElementById('stats-arrow').classList.toggle('expanded');
            if (!document.getElementById('stats-body').classList.contains('hidden')) {
                this.renderChart();
            }
        });
        document.querySelectorAll('.stats-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateStats(this.calculateStats());
                this.renderChart();
            });
        });
        document.getElementById('detail-close-btn').addEventListener('click', () => {
            document.getElementById('flower-detail-popup').classList.add('hidden');
        });
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
