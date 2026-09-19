/* Просмотрщик генплана «БОР 495».
 *
 * Нужен three.js r128 (глобальный THREE) и файл сцены bor495-scene.json.
 * Подключение:
 *     <script src="three.min.js"></script>
 *     <script src="bor495.js" data-scene="bor495-scene.json" defer></script>
 * Либо вручную:  BOR495.init(document.getElementById('bor495'), sceneObject);
 */
(function(global){
  "use strict";

  function boot(root, DATA){
      var canvas = root.querySelector('.bor-canvas');
    var boxW = function(){ return Math.max(1, root.clientWidth); };
    var boxH = function(){ return Math.max(1, root.clientHeight); };

    function fail(text){
      var b = root.querySelector('.bor-boot');
      if (b && b.parentNode) b.parentNode.removeChild(b);
      var box = document.createElement('div');
      box.className = 'card';
      box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
        'z-index:9;padding:18px 22px;max-width:min(420px,calc(100vw - 32px));' +
        'font-size:13px;line-height:1.5;text-align:center;';
      box.textContent = text;
      document.body.appendChild(box);
    }
    if (typeof THREE === 'undefined'){
      fail('Не загрузилась библиотека three.js. Откройте страницу при включённом ' +
           'интернете или используйте автономный файл, где библиотека внутри.');
      return;
    }
    var boot = root.querySelector('.bor-boot');
    function bootDone(){ if (boot && boot.parentNode) boot.parentNode.removeChild(boot); }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
      bootDone();
    } catch (err){
      fail('Браузер не смог запустить 3D (WebGL). Попробуйте открыть ссылку в ' +
           'Safari или Chrome, а не во встроенном браузере мессенджера, ' +
           'и включите аппаратное ускорение.');
      return;
    }
    var MOBILE = Math.min(boxW(), boxH()) < 760 ||
                 /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
    canvas.addEventListener('webglcontextlost', function(e){
      e.preventDefault();
      fail('3D остановилось: браузеру не хватило ресурсов. Закройте лишние ' +
           'вкладки и откройте страницу заново, лучше в Safari или Chrome.');
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);

    var SITE = {x:145, z:120};                      // центр участка в координатах сцены
    var target = new THREE.Vector3(SITE.x, 0, SITE.z);
    var sph = {r:350, theta:-0.9, phi:0.92};        // сферические координаты камеры

    // Размеры окна: в iframe на старте они бывают нулевыми, поэтому берём
    // первое ненулевое значение и никогда не отдаём ноль — иначе пропорция
    // выходит NaN и камера уезжает в никуда.
    var app = root;                       // контейнер виджета
    function sizeApp(){ return {w: boxW(), h: boxH()}; }
    function vw(){ return boxW(); }
    function vh(){ return boxH(); }

    // на узком экране камера отходит дальше, чтобы участок помещался целиком
    function fitK(){
      var a = vw() / vh();
      if (!isFinite(a) || a <= 0) return 1.0;
      return a >= 1.7 ? 1.0 : Math.min(2.4, 1.7 / Math.max(a, 0.35));
    }
    var lastK = fitK();

    var needle = root.querySelector('.bor-needle');
    var needleLabel = root.querySelector('.bor-needle-label');

    function applyCam(){
      var r = sph.r, p = Math.max(0.12, Math.min(1.53, sph.phi));
      camera.position.set(
        target.x + r*Math.sin(p)*Math.sin(sph.theta),
        target.y + r*Math.cos(p),
        target.z + r*Math.sin(p)*Math.cos(sph.theta));
      camera.lookAt(target);
      if (needle){                       // север — минус Z сцены
        var deg = sph.theta * 180 / Math.PI;
        needle.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ')');
        needleLabel.setAttribute('transform',
          'translate(0,-17) rotate(' + (-deg).toFixed(1) + ')');
      }
    }

    // ------------------------------------------------------------- материалы --
    var M = {
      site:   new THREE.MeshLambertMaterial({color:0x8fa06e}),
      road:   new THREE.MeshLambertMaterial({color:0x7c7f82}),
      parking:new THREE.MeshLambertMaterial({color:0x93969b}),
      path:   new THREE.MeshLambertMaterial({color:0xcbbfa4}),
      trail:  new THREE.MeshLambertMaterial({color:0x9e8b68}),
      terrace:new THREE.MeshLambertMaterial({color:0xb5834a}),
      platform:new THREE.MeshLambertMaterial({color:0xb3bd8e}),
      court:  new THREE.MeshLambertMaterial({color:0x2f7a52}),
      wall:   new THREE.MeshLambertMaterial({color:0xcfa470}),
      roof:   new THREE.MeshLambertMaterial({color:0x4a453e, side:THREE.DoubleSide}),
      canopy: new THREE.MeshLambertMaterial({color:0xb99b74}),
      water:  new THREE.MeshPhongMaterial({color:0x4fa3cc, shininess:90,
                transparent:true, opacity:0.85}),
      crown:  new THREE.MeshLambertMaterial({color:0x4f7a42}),
      trunk:  new THREE.MeshLambertMaterial({color:0x5a4632}),
      column: new THREE.MeshLambertMaterial({color:0xb08a5c}),
      stone:  new THREE.MeshLambertMaterial({color:0x8d8378}),
      tub:    new THREE.MeshLambertMaterial({color:0x8a6034}),
      equip:  new THREE.MeshLambertMaterial({color:0x8d9298}),
      deck:   new THREE.MeshLambertMaterial({color:0xb5834a}),
      platform:new THREE.MeshLambertMaterial({color:0xb3bd8e}),
      plinth: new THREE.MeshLambertMaterial({color:0x8a8880}),
      glass:  new THREE.MeshPhongMaterial({color:0x8fd0ee, shininess:110,
                transparent:true, opacity:0.62}),
      rail:   new THREE.MeshLambertMaterial({color:0x7a6040}),
      metal:  new THREE.MeshLambertMaterial({color:0x4a4f55})
    };
    var CYL = [M.column, M.stone, M.tub];

    // --------------------------------------------------------------- хелперы --
    function shapeOf(p){
      var s = new THREE.Shape();
      p.e.forEach(function(pt,i){ i ? s.lineTo(pt[0],pt[1]) : s.moveTo(pt[0],pt[1]); });
      (p.h||[]).forEach(function(hole){
        var hp = new THREE.Path();
        hole.forEach(function(pt,i){ i ? hp.lineTo(pt[0],pt[1]) : hp.moveTo(pt[0],pt[1]); });
        s.holes.push(hp);
      });
      return s;
    }
    function slab(p, h, y, mat, cast){
      var g = new THREE.ExtrudeGeometry(shapeOf(p), {depth:h, bevelEnabled:false});
      var m = new THREE.Mesh(g, mat);
      m.rotation.x = -Math.PI/2; m.position.y = y;
      m.receiveShadow = true; if (cast) m.castShadow = true;
      return m;
    }
    function stitch(rings, capped){
      var pos = [], v = function(p){ pos.push(p[0], p[2], -p[1]); };
      for (var k=0;k<rings.length-1;k++){
        var a = rings[k], b = rings[k+1], n = Math.min(a.length,b.length);
        for (var i=0;i<n-1;i++){
          v(a[i]); v(a[i+1]); v(b[i+1]);
          v(a[i]); v(b[i+1]); v(b[i]);
        }
      }
      if (capped){
        var top = rings[rings.length-1], c=[0,0,0];
        top.forEach(function(p){ c[0]+=p[0]; c[1]+=p[1]; c[2]+=p[2]; });
        c = [c[0]/top.length, c[1]/top.length, c[2]/top.length];
        for (var j=0;j<top.length-1;j++){ v(c); v(top[j]); v(top[j+1]); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      g.computeVertexNormals();
      return g;
    }
    function treeMesh(trees){
      var crown = [], trunk = [], SEG = 12;
      trees.forEach(function(t){
        var x=t[0], z=-t[1], h=t[2], r=t[3], tb=h*0.30, tr=Math.max(0.22, r*0.11);
        for (var i=0;i<SEG;i++){
          var a0=i/SEG*Math.PI*2, a1=(i+1)/SEG*Math.PI*2;
          var c0=[x+tr*Math.cos(a0), z+tr*Math.sin(a0)];
          var c1=[x+tr*Math.cos(a1), z+tr*Math.sin(a1)];
          trunk.push(c0[0],0,c0[1], c1[0],0,c1[1], c1[0],tb+0.4,c1[1]);
          trunk.push(c0[0],0,c0[1], c1[0],tb+0.4,c1[1], c0[0],tb+0.4,c0[1]);
          trunk.push(x,0,z, c1[0],0,c1[1], c0[0],0,c0[1]);
          [[tb, h*0.70, r],[h*0.55, h, r*0.66]].forEach(function(lv){
            var z0=lv[0], z1=lv[1], rr=lv[2];
            var p0=[x+rr*Math.cos(a0), z+rr*Math.sin(a0)];
            var p1=[x+rr*Math.cos(a1), z+rr*Math.sin(a1)];
            crown.push(p0[0],z0,p0[1], p1[0],z0,p1[1], x,z1,z);
            crown.push(x,z0,z, p1[0],z0,p1[1], p0[0],z0,p0[1]);
          });
        }
      });
      function mk(arr, mat){
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr,3));
        g.computeVertexNormals();
        var m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
        return m;
      }
      var grp = new THREE.Group(); grp.add(mk(crown,M.crown)); grp.add(mk(trunk,M.trunk));
      return grp;
    }
    var BADGES = [];
    function drawBadge(cv, text){
      var s = cv.width, g = cv.getContext('2d');
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#2A2A2A'; g.beginPath(); g.arc(s/2,s/2,s*0.36,0,7); g.fill();
      g.fillStyle = '#ffffff'; g.font = '600 56px "Inter Tight", system-ui, sans-serif';
      g.textAlign='center'; g.textBaseline='middle'; g.fillText(text, s/2, s/2+2);
    }
    function labelSprite(text){
      var cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      drawBadge(cv, text);
      var tex = new THREE.CanvasTexture(cv);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false}));
      sp.scale.set(9,9,1);
      BADGES.push({cv:cv, tex:tex, text:text});
      return sp;
    }
    function refreshBadges(){      // перерисовать номера вшитым шрифтом
      BADGES.forEach(function(b){ drawBadge(b.cv, b.text); b.tex.needsUpdate = true; });
    }

    // ------------------------------------------------------------- построение --
    var groups = {};
    function buildVariant(key){
      var d = DATA[key], root = new THREE.Group();
      var parts = {trees:new THREE.Group(), labels:new THREE.Group(),
                   paving:new THREE.Group(), build:new THREE.Group()};

      d.site.forEach(function(p){ root.add(slab(p, 0.3, -0.3, M.site)); });

      (d.fence||[]).forEach(function(fp){          // забор сплошной стеной
        var m = slab(fp, 2.2, 0.0, M.rail);
        m.castShadow = true; root.add(m);
      });

      d.slabs.forEach(function(s){
        var mat = M[s.t] || M.path;
        var y = (s.t==='deck'||s.t==='plinth') ? 0.0 :
                (s.t==='road'||s.t==='parking' ? -0.02 : -0.01);
        var h = (s.t==='deck') ? 0.5 : (s.z || 0.14);
        parts.paving.add(slab(s.p, h, y, mat));
      });
      d.water.forEach(function(p){ parts.paving.add(slab(p, 0.35, -0.4, M.water)); });
      d.equip.forEach(function(e){ parts.build.add(slab(e.p, e.h, 0, M.equip, true)); });
      if (d.stalls && d.stalls.length){
        var sm = new THREE.MeshLambertMaterial({color:0xdfe2e6});
        for (var si=0; si<d.stalls.length; si+=4){
          var ring = d.stalls.slice(si, si+4);
          if (ring.length < 4) break;
          parts.paving.add(slab({e:ring.concat([ring[0]]), h:[]}, 0.05, 0.10, sm));
        }
      }

      d.vols.forEach(function(v){
        var m = slab(v.p, v.h, v.z, M.wall, true);
        m.userData.pickable = true;
        parts.build.add(m);
      });

      function soup(arr, mat, cast){
        if (!arr || !arr.length) return;
        var g = new THREE.BufferGeometry(), pos = new Float32Array(arr.length);
        for (var i=0;i<arr.length;i+=3){ pos[i]=arr[i]; pos[i+1]=arr[i+2]; pos[i+2]=-arr[i+1]; }
        g.setAttribute('position', new THREE.BufferAttribute(pos,3));
        g.computeVertexNormals();
        var m = new THREE.Mesh(g, mat);
        m.castShadow = !!cast; m.receiveShadow = true;
        parts.build.add(m);
      }
      soup(d.wallfill, M.wall, true);

      (d.glass||[]).forEach(function(gl){
        parts.build.add(slab(gl.p, gl.h, gl.z, M.glass));
      });

      (d.rails||[]).forEach(function(r){
        var h = r[r.length-1], pts = r.slice(0, r.length-1);
        for (var i=0;i<pts.length-1;i++){
          var a = pts[i], b = pts[i+1];
          var len = Math.hypot(b[0]-a[0], b[1]-a[1]);
          var ang = Math.atan2(b[1]-a[1], b[0]-a[0]);
          [h-0.06, h*0.55].forEach(function(z){
            var g = new THREE.BoxGeometry(len, 0.07, 0.1);
            var m = new THREE.Mesh(g, M.rail);
            m.position.set((a[0]+b[0])/2, z, -(a[1]+b[1])/2);
            m.rotation.y = ang; parts.build.add(m);
          });
          var n = Math.max(2, Math.round(len/2.2)+1);
          for (var k=0;k<n;k++){
            var t = k/(n-1);
            var pm = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,h,6), M.rail);
            pm.position.set(a[0]+(b[0]-a[0])*t, h/2, -(a[1]+(b[1]-a[1])*t));
            parts.build.add(pm);
          }
        }
      });

      (d.lamps||[]).forEach(function(l){
        var h = l[2], road = l[3]===0;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(road?0.11:0.08,
                                  road?0.13:0.09, h, 8), M.metal);
        pole.position.set(l[0], h/2, -l[1]); pole.castShadow = true;
        parts.build.add(pole);
        var head = new THREE.Mesh(new THREE.CylinderGeometry(road?0.45:0.22,
                                  road?0.45:0.22, 0.18, 10), M.metal);
        head.position.set(l[0] + (road?0.9:0), h+0.05, -l[1]);
        parts.build.add(head);
        if (road){
          var arm = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.1,0.1), M.metal);
          arm.position.set(l[0]+0.45, h-0.05, -l[1]); parts.build.add(arm);
        }
      });

      (d.benches||[]).forEach(function(bn){
        var g = new THREE.Group();
        var seat = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.09,0.5), M.rail);
        seat.position.y = 0.45; g.add(seat);
        var back = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.34,0.08), M.rail);
        back.position.set(0,0.75,-0.2); g.add(back);
        [-0.8,0.8].forEach(function(dx){
          var leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.45,0.4), M.rail);
          leg.position.set(dx,0.22,0); g.add(leg);
        });
        g.position.set(bn[0], 0, -bn[1]);
        g.rotation.y = bn[2]*Math.PI/180;
        parts.build.add(g);
      });

      if (d.roofs.length){
        var g = new THREE.BufferGeometry();
        var src = d.roofs, pos = new Float32Array(src.length);
        for (var i=0;i<src.length;i+=3){ pos[i]=src[i]; pos[i+1]=src[i+2]; pos[i+2]=-src[i+1]; }
        g.setAttribute('position', new THREE.BufferAttribute(pos,3));
        g.computeVertexNormals();
        var rm = new THREE.Mesh(g, M.roof);
        rm.castShadow = true; rm.receiveShadow = true;
        parts.build.add(rm);
      }

      (d.barrels||[]).forEach(function(b){
        var geo = new THREE.CylinderGeometry(b[2], b[2], b[3], 22);
        geo.rotateZ(Math.PI/2);                       // ось цилиндра вдоль X
        geo.rotateY(b[4]*Math.PI/180);                // разворот по плану
        var m = new THREE.Mesh(geo, M.tub);
        m.position.set(b[0], b[5]+b[2], -b[1]);       // низ ровно на земле
        m.castShadow = true; m.receiveShadow = true;
        parts.build.add(m);
      });

      d.cyls.forEach(function(c){
        var h = c[4]-c[3];
        if (h <= 0.05) return;
        var geo = new THREE.CylinderGeometry(c[2], c[2]*1.06, h, 12);
        var m = new THREE.Mesh(geo, CYL[c[5]] || M.column);
        m.position.set(c[0], c[3]+h/2, -c[1]);
        m.castShadow = true; parts.build.add(m);
      });

      var byN = {};
      d.labels.forEach(function(l){
        var sp = labelSprite(String(l[3]));
        sp.position.set(l[0], l[2]+3, -l[1]);
        parts.labels.add(sp);
        byN[l[3]] = {x:l[0], y:l[1], h:l[2], name:l[4]};
      });

      parts.trees.add(treeMesh(d.trees));
      Object.keys(parts).forEach(function(k){ root.add(parts[k]); });
      root.userData = {parts:parts, byN:byN, data:d};
      root.visible = false;
      scene.add(root);
      return root;
    }
    groups.A = buildVariant('A');
    groups.B = buildVariant('B');

    // ------------------------------------------------------------------ свет --
    var hemi = new THREE.HemisphereLight(0xdfe7e4, 0x55603f, 0.75);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff0d8, 0.95);
    sun.position.set(SITE.x-190, 300, SITE.z-210);
    sun.target.position.copy(target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
    var sc = sun.shadow.camera;
    sc.left=-330; sc.right=330; sc.top=330; sc.bottom=-330; sc.near=1; sc.far=1200;
    scene.add(sun); scene.add(sun.target);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),
                                new THREE.MeshLambertMaterial({color:0x6f7a55}));
    ground.rotation.x = -Math.PI/2; ground.position.y = -0.45;
    ground.receiveShadow = true; scene.add(ground);

    // Небо и туман заданы жёстко: сцена — дневная панорама участка и не должна
    // темнеть вслед за интерфейсом браузера (встроенные браузеры мессенджеров
    // включают тёмную тему принудительно).
    scene.background = new THREE.Color(0xcfd8d0);
    scene.fog = new THREE.Fog(0xcfd8d0, 700, 1800);

    // --------------------------------------------------------------- интерфейс --
    var current = 'A';
    var EDITOR_SYNC = null;
    function setVariant(v){
      current = v;
      groups.A.visible = (v==='A'); groups.B.visible = (v==='B');
      root.querySelector('.bor-variant-name').textContent =
        'Загородный банный комплекс. ' + DATA[v].title;
      root.querySelectorAll('.bor-variants button').forEach(function(b){
        b.setAttribute('aria-pressed', String(b.dataset.v===v));
      });
      renderPanel(DATA[v]);
      applyLayers();
      if (EDITOR_SYNC) EDITOR_SYNC();
    }
    function renderPanel(d){
      var box = root.querySelector('.bor-expl');
      box.innerHTML = '';
      d.expl.forEach(function(r){
        var b = document.createElement('button');
        b.className = 'bor-item';
        b.innerHTML = '<span class="bor-n">'+r[0]+'</span><span>'+r[1]+
                      (r[3]>1 ? ' <span class="s">×'+r[3]+'</span>' : '')+
                      '</span><span class="bor-s">'+r[2].toLocaleString('ru-RU')+' м²</span>';
        b.addEventListener('click', function(){ setExpl(false); flyTo(r[0]); });
        box.appendChild(b);
      });
      var tep = root.querySelector('.bor-tep');
      tep.innerHTML = '';
      d.tep.forEach(function(t){
        var row = document.createElement('div');
        var val = t[1].toLocaleString('ru-RU') + ' ' + (t[3] || 'м²');
        if (t[2] !== null && t[2] !== undefined) val += ' · ' + t[2].toFixed(1) + '%';
        row.innerHTML = '<span>' + t[0] + '</span><b>' + val + '</b>';
        tep.appendChild(row);
      });
      root.querySelector('.bor-stalls').textContent = d.stallCount + ' м/м';
    }
    var layers = {trees:true, labels:true, paving:true};
    function applyLayers(){
      var p = groups[current].userData.parts;
      p.trees.visible = layers.trees;
      p.labels.visible = layers.labels;
      p.paving.visible = layers.paving;
    }
    var explBtn = root.querySelector('.bor-expl-btn');
    function setExpl(open){
      app.classList.toggle('expl-open', open);
      explBtn.setAttribute('aria-expanded', String(open));
      explBtn.setAttribute('aria-pressed', String(open));
    }
    explBtn.addEventListener('click', function(){
      setExpl(!app.classList.contains('expl-open'));
    });
    root.querySelector('.bor-expl-close').addEventListener('click', function(){
      setExpl(false);
    });

    root.querySelector('.bor-variants').addEventListener('click', function(e){
      var b = e.target.closest('button'); if (b) setVariant(b.dataset.v);
    });
    root.querySelector('.bor-layers').addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      layers[b.dataset.layer] = !layers[b.dataset.layer];
      b.setAttribute('aria-pressed', String(layers[b.dataset.layer]));
      applyLayers();
    });

    var orbiting = false;
    // theta = 0 — камера южнее цели (ось z сцены смотрит на юг участка)
    var VIEWS = {axo:  {r:350, theta:-0.9, phi:0.92},
                 plan: {r:400, theta:0.0,  phi:0.14},
                 entry:{r:185, theta:0.0,  phi:1.33, t:{x:114, z:140}, maxFit:1.15}};
    root.querySelector('.bor-views').addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b || !b.dataset.view) return;
      if (b.dataset.view==='orbit'){
        orbiting = !orbiting; b.setAttribute('aria-pressed', String(orbiting)); return;
      }
      var v = VIEWS[b.dataset.view];
      target.set(v.t ? v.t.x : SITE.x, 0, v.t ? v.t.z : SITE.z);
      var k = v.maxFit ? Math.min(v.maxFit, fitK()) : fitK();
      tween({r: v.r * k, theta: v.theta, phi: v.phi});
    });
    var anim = null;
    function tween(to){
      var from = {r:sph.r, theta:sph.theta, phi:sph.phi}, t0 = performance.now();
      anim = function(now){
        var k = Math.min(1,(now-t0)/700), e = 1-Math.pow(1-k,3);
        sph.r = from.r+(to.r-from.r)*e;
        sph.theta = from.theta+(to.theta-from.theta)*e;
        sph.phi = from.phi+(to.phi-from.phi)*e;
        if (k>=1) anim = null;
      };
    }
    function flyTo(n){
      var o = groups[current].userData.byN[n]; if (!o) return;
      target.set(o.x, 0, -o.y);
      tween({r:95, theta:sph.theta, phi:0.95});
      showReadout(n + ' · ' + o.name);
    }
    var readout = root.querySelector('.bor-readout'), roTimer = null;
    function showReadout(text){
      readout.textContent = text; readout.classList.add('on');
      clearTimeout(roTimer); roTimer = setTimeout(function(){ readout.classList.remove('on'); }, 2600);
    }

    // ------------------------------------------------------------- управление --
    // мышь: тянуть — поворот, Shift или правая кнопка — сдвиг, колесо — зум.
    // палец: один — поворот, два — сдвиг и щипок.
    var pts = new Map(), drag = null, gest = null;

    function two(){
      var a = Array.from(pts.values());
      var dx = a[0].x - a[1].x, dy = a[0].y - a[1].y;
      return {d: Math.hypot(dx, dy) || 1,
              cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2};
    }
    function panBy(dx, dy){
      var k = sph.r * 0.0016;
      var si = Math.sin(sph.theta), co = Math.cos(sph.theta);
      target.x -= (dx * co - dy * si) * k;
      target.z += (dx * si + dy * co) * k;
    }

    canvas.addEventListener('pointerdown', function(e){
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if (pts.size === 1){
        drag = {x:e.clientX, y:e.clientY, pan:e.shiftKey || e.button === 2, moved:0};
        gest = null;
      } else if (pts.size === 2){
        drag = null; gest = two();          // второй палец — переходим к жесту
      }
    });

    canvas.addEventListener('pointermove', function(e){
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if (pts.size >= 2){
        if (!gest) { gest = two(); return; }
        var g = two();
        sph.r = Math.max(55, Math.min(900, sph.r * gest.d / g.d));
        panBy(g.cx - gest.cx, g.cy - gest.cy);
        gest = g;
        applyCam();
        return;
      }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) panBy(dx, dy);
      else {
        sph.theta -= dx * 0.005;
        sph.phi = Math.max(0.12, Math.min(1.53, sph.phi - dy * 0.005));
      }
    });

    function release(e){
      var had = pts.size;
      pts.delete(e.pointerId);
      if (pts.size < 2) gest = null;
      if (had === 1 && drag && drag.moved < 10) pick(e);
      if (pts.size === 0) drag = null;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    canvas.addEventListener('wheel', function(e){
      e.preventDefault();
      sph.r = Math.max(55, Math.min(900, sph.r * (1 + Math.sign(e.deltaY) * 0.12)));
    }, {passive:false});

    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e){
      var rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX-rect.left)/rect.width)*2-1;
      ndc.y = -((e.clientY-rect.top)/rect.height)*2+1;
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(groups[current].userData.parts.build.children, false);
      if (!hits.length) return;
      var p = hits[0].point, best = null, bd = 1e9, byN = groups[current].userData.byN;
      Object.keys(byN).forEach(function(n){
        var o = byN[n], d = Math.pow(o.x-p.x,2)+Math.pow(-o.y-p.z,2);
        if (d < bd){ bd = d; best = n; }
      });
      if (best !== null) flyTo(Number(best));
    }

    var BASE_R = sph.r;
    function resize(){
      var box = sizeApp();
      var w = box.w, h = box.h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      var k = fitK();
      if (isFinite(k) && isFinite(lastK) && Math.abs(k - lastK) > 0.01){
        sph.r *= k / lastK; lastK = k;
      }
      if (!isFinite(sph.r) || sph.r <= 0) sph.r = BASE_R * (isFinite(k) ? k : 1);
      applyCam();
    }
    // окно может получить размер позже (iframe, скрытая вкладка) — следим за этим
    if (typeof ResizeObserver !== 'undefined')
      new ResizeObserver(resize).observe(root);
    addEventListener('resize', resize);
    addEventListener('orientationchange', resize);
    sph.r = BASE_R * lastK; resize(); setVariant('A');
    // номера домов рисуются на canvas, поэтому ждём загрузки вшитого шрифта
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(refreshBadges);
    }
    // некоторые мобильные браузеры сообщают размер окна не сразу
    [60, 250, 700, 1500].forEach(function(ms){ setTimeout(resize, ms); });

  

    (function loop(now){
      requestAnimationFrame(loop);
      if (anim) anim(now||0);
      if (orbiting && !drag) sph.theta -= 0.0016;
      applyCam();
      renderer.render(scene, camera);
    })();  }

  var API = {
    init: function(root, data){
      if (!root) throw new Error('BOR495: не найден контейнер');
      if (typeof THREE === 'undefined') throw new Error('BOR495: не подключён three.js');
      boot(root, data);
    },
    load: function(root, url){
      return fetch(url, {credentials:'same-origin'})
        .then(function(r){
          if (!r.ok) throw new Error('BOR495: сцена не загрузилась (' + r.status + ')');
          return r.json();
        })
        .then(function(data){ API.init(root, data); return data; });
    }
  };
  global.BOR495 = API;

  // Автозапуск: если у тега скрипта задан data-scene, грузим её сами.
  var tag = document.currentScript;
  if (tag && tag.dataset.scene){
    var url = tag.dataset.scene;
    var id = tag.dataset.target || 'bor495';
    var start = function(){
      var root = document.getElementById(id);
      if (root) API.load(root, url).catch(function(e){ console.error(e); });
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(window);
