    /* =========================================================
       NAV (scroll style + mobile menu)
       ========================================================= */
    (function () {
      const nav = document.getElementById('nav');
      const onScroll = () => {
        if (window.scrollY > 30) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      const toggle = document.getElementById('navToggle');
      toggle.addEventListener('click', () => nav.classList.toggle('open'));
      document.querySelectorAll('.nav-links a').forEach((a) =>
        a.addEventListener('click', () => nav.classList.remove('open'))
      );
    })();

    /* =========================================================
       CARS + PROFILES — data, Supabase wiring, drag-and-drop UI
       ========================================================= */
    (function () {
      const SUPABASE_URL = 'https://vcydfghyvjnjktbvzvzt.supabase.co';
      const SUPABASE_KEY = 'sb_publishable_E6SC2PWqEpRm5HiCRtZP3A_uuEtRYch';
      const AVATAR_BUCKET = 'avatars';

      // Static per-person metadata that doesn't live in the DB.
      const PERSON_META = {
        kristof: { note: 'Veszprémben csatlakozik' },
      };

      const sb = window.supabase
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

      const profileCache = {}; // id -> { id, name, avatar_url, car_id, role }
      const carCache = {};     // id -> { id, title, origin, image_url, position }

      const nameOf      = (id) => (profileCache[id] && profileCache[id].name) || id;
      const avatarOf    = (id) => (profileCache[id] && profileCache[id].avatar_url) || null;
      const roleOf      = (id) => (profileCache[id] && profileCache[id].role) || 'passenger';
      const carIdOf     = (id) => (profileCache[id] && profileCache[id].car_id) || null;
      const carTitleOf  = (id) => (carCache[id] && carCache[id].title) || '';
      const carOriginOf = (id) => (carCache[id] && carCache[id].origin) || '';
      const carImageOf  = (id) => (carCache[id] && carCache[id].image_url) || null;
      const initialOf   = (name) => (name || '').trim().charAt(0).toUpperCase() || '?';

      /* ---------- DOM builders ---------- */

      function buildPersonNode(personId) {
        const isDriver = roleOf(personId) === 'driver';
        const meta = PERSON_META[personId] || {};
        const name = nameOf(personId);
        const avatar = avatarOf(personId);

        const wrapper = document.createElement('div');
        wrapper.className = 'person' + (isDriver ? ' person--driver' : '');
        wrapper.dataset.person = personId;
        wrapper.draggable = true;

        wrapper.innerHTML = `
          <button class="person-avatar" type="button" aria-label="Profilkép cseréje (${name})" draggable="false">
            <img class="person-avatar-img" alt="${name}" ${avatar ? `src="${avatar}"` : 'hidden'}>
            <span class="person-avatar-initials" ${avatar ? 'hidden' : ''}>${initialOf(name)}</span>
            <span class="person-avatar-overlay" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
            </span>
            <input class="person-avatar-input" type="file" accept="image/*" hidden>
          </button>
          <div class="person-name" contenteditable="true" spellcheck="false">${name}</div>
          ${isDriver ? '<div class="person-role">sofőr</div>' : ''}
          ${meta.note ? `<div class="person-note">${meta.note}</div>` : ''}
        `;

        wirePerson(wrapper);
        return wrapper;
      }

      function buildCarNode(carId) {
        const title = carTitleOf(carId);
        const origin = carOriginOf(carId);
        const image = carImageOf(carId);

        const card = document.createElement('div');
        card.className = 'car-card';
        card.dataset.car = carId;
        card.innerHTML = `
          <div class="car-header">
            <button class="car-image" type="button" aria-label="Autó képének cseréje (${title})">
              <img class="car-image-img" alt="${title}" ${image ? `src="${image}"` : 'hidden'}>
              <span class="car-image-fallback" ${image ? 'hidden' : ''} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 11l1.5-4.5h11L19 11h-2l-.5-1.5h-9L7 11H5zm-1 1h16v6h-2v-2H6v2H4v-6zm3 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
              </span>
              <span class="car-image-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
              </span>
              <input class="car-image-input" type="file" accept="image/*" hidden>
            </button>
            <div class="car-header-text">
              <div class="car-origin">${origin}</div>
              <div class="car-title" contenteditable="true" spellcheck="false">${title}</div>
            </div>
          </div>
          <div class="car-section-label">Sofőr</div>
          <div class="car-driver-slot" data-zone="driver"></div>
          <div class="car-section-label">Utasok</div>
          <div class="car-passengers" data-zone="passenger"></div>
        `;
        wireCar(card);
        return card;
      }

      function renderAll() {
        const grid = document.getElementById('carsGrid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.keys(carCache)
          .sort((a, b) => (carCache[a].position || 0) - (carCache[b].position || 0))
          .forEach((carId) => {
            grid.appendChild(buildCarNode(carId));
            renderCarPeople(carId);
          });
      }

      function renderCarPeople(carId) {
        const card = document.querySelector(`[data-car="${carId}"]`);
        if (!card) return;
        const driverSlot = card.querySelector('.car-driver-slot');
        const passengers = card.querySelector('.car-passengers');
        driverSlot.innerHTML = '';
        passengers.innerHTML = '';
        const inCar = Object.values(profileCache).filter((p) => p.car_id === carId);
        inCar.sort((a, b) => a.id.localeCompare(b.id));
        inCar.forEach((p) => {
          const node = buildPersonNode(p.id);
          (p.role === 'driver' ? driverSlot : passengers).appendChild(node);
        });
      }

      function applyProfileToDom(personId) {
        const el = document.querySelector(`[data-person="${personId}"]`);
        if (!el) return;
        const name = nameOf(personId);
        const avatar = avatarOf(personId);

        const nameEl = el.querySelector('.person-name');
        if (document.activeElement !== nameEl) nameEl.textContent = name;

        const img = el.querySelector('.person-avatar-img');
        const initials = el.querySelector('.person-avatar-initials');
        if (avatar) {
          img.src = avatar;
          img.hidden = false;
          img.alt = name;
          initials.hidden = true;
        } else {
          img.hidden = true;
          img.removeAttribute('src');
          initials.hidden = false;
          initials.textContent = initialOf(name);
        }
        el.querySelector('.person-avatar').setAttribute('aria-label', `Profilkép cseréje (${name})`);
      }

      function applyCarToDom(carId) {
        const card = document.querySelector(`[data-car="${carId}"]`);
        if (!card) return;
        const title = carTitleOf(carId);
        const image = carImageOf(carId);
        const origin = carOriginOf(carId);

        const titleEl = card.querySelector('.car-title');
        if (document.activeElement !== titleEl) titleEl.textContent = title;
        card.querySelector('.car-origin').textContent = origin;

        const img = card.querySelector('.car-image-img');
        const fb = card.querySelector('.car-image-fallback');
        if (image) {
          img.src = image;
          img.hidden = false;
          img.alt = title;
          fb.hidden = true;
        } else {
          img.hidden = true;
          img.removeAttribute('src');
          fb.hidden = false;
        }
        card.querySelector('.car-image').setAttribute('aria-label', `Autó képének cseréje (${title})`);
      }

      /* ---------- Wire interactions ---------- */

      function wirePerson(node) {
        const id = node.dataset.person;
        const avatarBtn = node.querySelector('.person-avatar');
        const fileInput = node.querySelector('.person-avatar-input');
        const nameEl = node.querySelector('.person-name');

        avatarBtn.addEventListener('click', (e) => {
          if (e.target === fileInput) return;
          fileInput.click();
        });
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (file) handlePersonAvatarFile(id, file, avatarBtn);
        });

        // Prevent the contenteditable from initiating a drag
        nameEl.addEventListener('mousedown', () => { node.draggable = false; });
        nameEl.addEventListener('mouseup',   () => { node.draggable = true; });
        nameEl.addEventListener('blur',      () => { node.draggable = true; });

        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = nameOf(id); nameEl.blur(); }
        });
        nameEl.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text');
          document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
        });
        nameEl.addEventListener('blur', () => {
          let name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
          if (!name) name = nameOf(id);
          nameEl.textContent = name;
          if (name !== nameOf(id)) saveProfile(id, { name });
        });

        // Drag source
        node.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
          requestAnimationFrame(() => node.classList.add('is-dragging'));
        });
        node.addEventListener('dragend', () => {
          node.classList.remove('is-dragging');
          document.querySelectorAll('.car-card.is-drop-target')
            .forEach((c) => c.classList.remove('is-drop-target'));
        });
      }

      function wireCar(card) {
        const id = card.dataset.car;
        const imageBtn = card.querySelector('.car-image');
        const fileInput = card.querySelector('.car-image-input');
        const titleEl = card.querySelector('.car-title');

        imageBtn.addEventListener('click', (e) => {
          if (e.target === fileInput) return;
          fileInput.click();
        });
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (file) handleCarImageFile(id, file, imageBtn);
        });

        titleEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter')  { e.preventDefault(); titleEl.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); titleEl.textContent = carTitleOf(id); titleEl.blur(); }
        });
        titleEl.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text');
          document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
        });
        titleEl.addEventListener('blur', () => {
          let title = (titleEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
          if (!title) title = carTitleOf(id);
          titleEl.textContent = title;
          if (title !== carTitleOf(id)) saveCar(id, { title });
        });

        // Drop target — accepts the whole card. Zone (driver vs passenger) inferred at drop time.
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          card.classList.add('is-drop-target');
        });
        card.addEventListener('dragleave', (e) => {
          if (!card.contains(e.relatedTarget)) card.classList.remove('is-drop-target');
        });
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.classList.remove('is-drop-target');
          const personId = e.dataTransfer.getData('text/plain');
          if (!personId || !profileCache[personId]) return;
          const zone = e.target.closest('[data-zone]');
          const role = zone && zone.dataset.zone === 'driver' ? 'driver' : 'passenger';
          movePersonToCar(personId, id, role);
        });
      }

      /* ---------- Image upload pipeline ---------- */

      function fileToSquareJpegBlob(file, size) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Image load failed'));
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              const scale = Math.max(size / img.width, size / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
              canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.85);
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function uploadToAvatars(folder, blob) {
        const path = `${folder}/${Date.now()}.jpg`;
        const { error: upErr } = await sb.storage
          .from(AVATAR_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
        return pub.publicUrl;
      }

      async function handlePersonAvatarFile(id, file, btn) {
        if (!file.type.startsWith('image/')) return;
        btn.classList.add('is-uploading');
        try {
          const blob = await fileToSquareJpegBlob(file, 320);
          const url = await uploadToAvatars(`person/${id}`, blob);
          await saveProfile(id, { avatar_url: url });
        } catch (err) {
          console.warn('avatar upload failed', err);
          alert('A feltöltés nem sikerült. Próbáld újra.');
        } finally {
          btn.classList.remove('is-uploading');
        }
      }

      async function handleCarImageFile(id, file, btn) {
        if (!file.type.startsWith('image/')) return;
        btn.classList.add('is-uploading');
        try {
          const blob = await fileToSquareJpegBlob(file, 320);
          const url = await uploadToAvatars(`car/${id}`, blob);
          await saveCar(id, { image_url: url });
        } catch (err) {
          console.warn('car image upload failed', err);
          alert('A feltöltés nem sikerült. Próbáld újra.');
        } finally {
          btn.classList.remove('is-uploading');
        }
      }

      /* ---------- Supabase I/O ---------- */

      async function loadAll() {
        if (!sb) return;
        const [cars, profiles] = await Promise.all([
          sb.from('cars').select('id, title, origin, image_url, position'),
          sb.from('profiles').select('id, name, avatar_url, car_id, role'),
        ]);
        if (cars.error)     { console.warn('cars load failed', cars.error); return; }
        if (profiles.error) { console.warn('profiles load failed', profiles.error); return; }

        cars.data.forEach((row) => { carCache[row.id] = row; });
        profiles.data.forEach((row) => { profileCache[row.id] = row; });
        renderAll();
      }

      async function saveProfile(id, patch) {
        if (!sb) return;
        const prev = { ...(profileCache[id] || {}) };
        profileCache[id] = { ...prev, ...patch };
        applyProfileToDom(id);
        const { error } = await sb.from('profiles').update(patch).eq('id', id);
        if (error) {
          console.warn('profile save failed', error);
          profileCache[id] = prev;
          applyProfileToDom(id);
        }
      }

      async function saveCar(id, patch) {
        if (!sb) return;
        const prev = { ...(carCache[id] || {}) };
        carCache[id] = { ...prev, ...patch };
        applyCarToDom(id);
        const { error } = await sb.from('cars').update(patch).eq('id', id);
        if (error) {
          console.warn('car save failed', error);
          carCache[id] = prev;
          applyCarToDom(id);
        }
      }

      async function movePersonToCar(personId, carId, role) {
        if (!sb) return;
        const prev = { ...(profileCache[personId] || {}) };
        if (prev.car_id === carId && prev.role === role) return;

        // Optimistic local state
        const demoted = [];
        if (role === 'driver') {
          Object.values(profileCache).forEach((p) => {
            if (p.car_id === carId && p.role === 'driver' && p.id !== personId) {
              demoted.push({ id: p.id, prev: { ...p } });
              profileCache[p.id] = { ...p, role: 'passenger' };
            }
          });
        }
        profileCache[personId] = { ...prev, car_id: carId, role };
        if (prev.car_id && prev.car_id !== carId) renderCarPeople(prev.car_id);
        renderCarPeople(carId);

        try {
          const ops = [];
          if (demoted.length > 0) {
            ops.push(
              sb.from('profiles')
                .update({ role: 'passenger' })
                .eq('car_id', carId)
                .eq('role', 'driver')
                .neq('id', personId)
            );
          }
          ops.push(
            sb.from('profiles')
              .update({ car_id: carId, role })
              .eq('id', personId)
          );
          const results = await Promise.all(ops);
          const err = results.find((r) => r.error);
          if (err) throw err.error;
        } catch (err) {
          console.warn('move failed, reverting', err);
          profileCache[personId] = prev;
          demoted.forEach(({ id, prev }) => { profileCache[id] = prev; });
          if (prev.car_id && prev.car_id !== carId) renderCarPeople(prev.car_id);
          renderCarPeople(carId);
        }
      }

      function subscribeRealtime() {
        if (!sb) return;
        sb.channel('trip-feed')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
            const row = payload.new;
            if (!row || !row.id) return;
            const prev = profileCache[row.id];
            profileCache[row.id] = row;
            const moved = !prev || prev.car_id !== row.car_id || prev.role !== row.role;
            if (moved) {
              if (prev && prev.car_id) renderCarPeople(prev.car_id);
              if (row.car_id) renderCarPeople(row.car_id);
            } else {
              applyProfileToDom(row.id);
            }
            // Drivers may have changed → refresh payer dropdown
            refreshPayerOptions();
            // Person name change should ripple to expense rows
            applyProfilesToExpenseList();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
            const row = payload.new;
            if (!row || !row.id) return;
            const knew = !!carCache[row.id];
            carCache[row.id] = row;
            if (knew) applyCarToDom(row.id);
            else renderAll(); // brand new car
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
            const newRow = payload.new;
            const oldRow = payload.old;
            if (payload.eventType === 'DELETE' && oldRow && oldRow.id) {
              delete expenseCache[oldRow.id];
            } else if (newRow && newRow.id) {
              expenseCache[newRow.id] = newRow;
            }
            renderCostSummary();
            renderCostList();
          })
          .subscribe();
      }

      /* =========================================================
         EXPENSES — travel cost tracker (13-way split)
         ========================================================= */

      const TRIP_HEADCOUNT = 13;
      const expenseCache = {}; // id -> expense row
      let pendingReceiptBlob = null;

      const CATEGORY = {
        vignette: { label: 'Autópálya matrica', short: 'Matrica', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4V7zm0 4h16v2H4v-2zm0 4h10v2H4v-2zM18 5h-2V3H8v2H6c-1.1 0-2 .9-2 2v0h16V7c0-1.1-.9-2-2-2z"/></svg>' },
        fuel:     { label: 'Üzemanyag',         short: 'Tank',    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>' },
      };

      const CURRENCY = {
        EUR: { symbol: '€', locale: 'hu-HU', fractionDigits: 2 },
        HUF: { symbol: 'Ft', locale: 'hu-HU', fractionDigits: 0 },
      };

      function formatMoney(amount, currency) {
        const c = CURRENCY[currency] || CURRENCY.EUR;
        const n = Number(amount);
        if (!isFinite(n)) return '–';
        return n.toLocaleString(c.locale, {
          minimumFractionDigits: c.fractionDigits,
          maximumFractionDigits: c.fractionDigits,
        }) + ' ' + c.symbol;
      }

      function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
      }

      function initialsHtml(name) {
        return (name || '').trim().charAt(0).toUpperCase() || '?';
      }

      function refreshPayerOptions() {
        const select = document.getElementById('costPayer');
        if (!select) return;
        const drivers = Object.values(profileCache).filter((p) => p.role === 'driver');
        drivers.sort((a, b) => a.name.localeCompare(b.name, 'hu-HU'));
        const current = select.value;
        select.innerHTML = '';
        if (drivers.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '— nincs sofőr —';
          select.appendChild(opt);
          return;
        }
        drivers.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          select.appendChild(opt);
        });
        if (drivers.some((p) => p.id === current)) select.value = current;
      }

      function renderCostSummary() {
        const root = document.getElementById('costSummary');
        if (!root) return;
        root.innerHTML = '';

        // Aggregate per currency, per category
        const totals = {}; // currency -> { total, byCategory: { vignette, fuel } }
        Object.values(expenseCache).forEach((e) => {
          if (!totals[e.currency]) totals[e.currency] = { total: 0, byCategory: { vignette: 0, fuel: 0 } };
          const amt = Number(e.amount) || 0;
          totals[e.currency].total += amt;
          totals[e.currency].byCategory[e.category] = (totals[e.currency].byCategory[e.category] || 0) + amt;
        });

        const currencies = Object.keys(totals).sort();
        if (currencies.length === 0) {
          root.innerHTML = '<div class="cost-summary--empty">Még nincs költség rögzítve.</div>';
          return;
        }

        currencies.forEach((cur) => {
          const t = totals[cur];
          const card = document.createElement('div');
          card.className = 'cost-summary-card';
          card.innerHTML = `
            <div class="cost-summary-label">Összesen ${cur}</div>
            <div class="cost-summary-amount">${formatMoney(t.total, cur)}</div>
            <div class="cost-summary-split"><strong>${formatMoney(t.total / TRIP_HEADCOUNT, cur)}</strong> / fő (${TRIP_HEADCOUNT})</div>
            <div class="cost-summary-breakdown">
              <div class="cost-summary-row"><span>${CATEGORY.vignette.short}</span><strong>${formatMoney(t.byCategory.vignette, cur)}</strong></div>
              <div class="cost-summary-row"><span>${CATEGORY.fuel.short}</span><strong>${formatMoney(t.byCategory.fuel, cur)}</strong></div>
            </div>
          `;
          root.appendChild(card);
        });
      }

      function renderCostList() {
        const root = document.getElementById('costList');
        if (!root) return;
        const list = Object.values(expenseCache).slice();
        list.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
        root.innerHTML = '';
        list.forEach((e) => root.appendChild(buildCostEntryNode(e)));
      }

      function buildCostEntryNode(e) {
        const payer = profileCache[e.payer_id];
        const payerName = payer ? payer.name : e.payer_id;
        const payerAvatar = payer ? payer.avatar_url : null;
        const cat = CATEGORY[e.category] || { label: e.category, short: e.category, icon: '' };
        const row = document.createElement('div');
        row.className = 'cost-entry';
        row.dataset.expense = e.id;

        const avatarStyle = payerAvatar ? `background-image: url('${payerAvatar}')` : '';
        const avatarText = payerAvatar ? '' : initialsHtml(payerName);
        const subParts = [formatDate(e.paid_at)];
        if (e.note) subParts.push(e.note);

        row.innerHTML = `
          <div class="cost-entry-payer">
            <div class="cost-entry-avatar" style="${avatarStyle}">${avatarText}</div>
            <div class="cost-entry-name">${escapeHtml(payerName)}</div>
          </div>
          <div class="cost-entry-meta">
            <div class="cost-entry-category">${cat.icon}<span>${cat.short}</span></div>
            <div class="cost-entry-sub">${escapeHtml(subParts.join(' · '))}</div>
          </div>
          <div class="cost-entry-amount">${formatMoney(e.amount, e.currency)}</div>
          ${e.receipt_url
            ? `<button class="cost-entry-receipt" type="button" data-receipt="${e.receipt_url}" style="background-image: url('${e.receipt_url}')" aria-label="Számla megnyitása"></button>`
            : `<button class="cost-entry-receipt is-empty" type="button" disabled aria-label="Nincs számla"><svg viewBox="0 0 24 24"><path d="M19 7h-3V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg></button>`}
          <button class="cost-entry-delete" type="button" data-delete="${e.id}" aria-label="Tétel törlése">×</button>
        `;
        return row;
      }

      function applyProfilesToExpenseList() {
        renderCostList();
      }

      function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
      }

      /* Form wiring */

      function wireCostForm() {
        const form = document.getElementById('costForm');
        if (!form) return;
        const receiptBtn = document.getElementById('costReceiptBtn');
        const receiptInput = document.getElementById('costReceiptInput');
        const receiptLabel = document.getElementById('costReceiptLabel');
        const receiptPreview = document.getElementById('costReceiptPreview');
        const submitBtn = document.getElementById('costSubmit');
        const errorEl = document.getElementById('costFormError');

        receiptBtn.addEventListener('click', () => receiptInput.click());
        receiptInput.addEventListener('change', async () => {
          const file = receiptInput.files && receiptInput.files[0];
          receiptInput.value = '';
          if (!file) return;
          if (!file.type.startsWith('image/')) return;
          try {
            pendingReceiptBlob = await fileToCompressedJpegBlob(file, 1200);
            receiptLabel.textContent = file.name.length > 28 ? file.name.slice(0, 25) + '…' : file.name;
            receiptBtn.classList.add('has-file');
            receiptPreview.src = URL.createObjectURL(pendingReceiptBlob);
            receiptPreview.hidden = false;
          } catch (err) {
            console.warn('receipt prep failed', err);
            errorEl.textContent = 'A kép nem dolgozható fel.';
          }
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          const fd = new FormData(form);
          const payer_id = fd.get('payer_id');
          const category = fd.get('category');
          const amount = parseFloat(fd.get('amount'));
          const currency = fd.get('currency');
          const note = (fd.get('note') || '').toString().trim() || null;

          if (!payer_id) { errorEl.textContent = 'Válassz fizetőt.'; return; }
          if (!(amount > 0)) { errorEl.textContent = 'Az összeg nagyobb kell legyen mint 0.'; return; }
          if (!CATEGORY[category]) { errorEl.textContent = 'Válassz típust.'; return; }
          if (!CURRENCY[currency]) { errorEl.textContent = 'Válassz pénznemet.'; return; }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Mentés…';
          try {
            let receipt_url = null;
            if (pendingReceiptBlob) {
              receipt_url = await uploadToAvatars(`receipts/${payer_id}`, pendingReceiptBlob);
            }
            const { error } = await sb.from('expenses').insert({
              payer_id, category, amount, currency, note, receipt_url,
            });
            if (error) throw error;

            // Reset form
            form.reset();
            pendingReceiptBlob = null;
            receiptLabel.textContent = 'Kép kiválasztása';
            receiptBtn.classList.remove('has-file');
            receiptPreview.hidden = true;
            receiptPreview.removeAttribute('src');
          } catch (err) {
            console.warn('expense save failed', err);
            errorEl.textContent = 'Nem sikerült menteni a tételt. Próbáld újra.';
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Hozzáadás';
          }
        });

        // Delegate clicks for receipt preview + delete inside the list
        document.getElementById('costList').addEventListener('click', (e) => {
          const receipt = e.target.closest('[data-receipt]');
          if (receipt) {
            openLightbox(receipt.dataset.receipt);
            return;
          }
          const del = e.target.closest('[data-delete]');
          if (del) {
            const id = del.dataset.delete;
            if (confirm('Biztosan törlöd ezt a tételt?')) deleteExpense(id);
          }
        });
      }

      async function deleteExpense(id) {
        if (!sb || !expenseCache[id]) return;
        const prev = expenseCache[id];
        delete expenseCache[id];
        renderCostSummary();
        renderCostList();
        const { error } = await sb.from('expenses').delete().eq('id', id);
        if (error) {
          console.warn('expense delete failed', error);
          expenseCache[id] = prev;
          renderCostSummary();
          renderCostList();
        }
      }

      // Lightbox
      function openLightbox(url) {
        const lb = document.getElementById('lightbox');
        const img = document.getElementById('lightboxImg');
        if (!lb || !img) return;
        img.src = url;
        lb.classList.add('is-open');
        lb.setAttribute('aria-hidden', 'false');
      }
      function closeLightbox() {
        const lb = document.getElementById('lightbox');
        if (!lb) return;
        lb.classList.remove('is-open');
        lb.setAttribute('aria-hidden', 'true');
        document.getElementById('lightboxImg').removeAttribute('src');
      }

      function fileToCompressedJpegBlob(file, maxDimension) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Image load failed'));
            img.onload = () => {
              const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
              const w = Math.round(img.width * scale);
              const h = Math.round(img.height * scale);
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.82);
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function loadExpenses() {
        if (!sb) return;
        const { data, error } = await sb.from('expenses').select('*').order('paid_at', { ascending: false });
        if (error) { console.warn('expenses load failed', error); return; }
        data.forEach((row) => { expenseCache[row.id] = row; });
        renderCostSummary();
        renderCostList();
      }

      /* ---------- Boot ---------- */

      document.addEventListener('DOMContentLoaded', async () => {
        // This module only initializes on pages that have the cars/costs UI.
        if (!document.getElementById('carsGrid')) return;

        // Lightbox close
        const lb = document.getElementById('lightbox');
        if (lb) lb.addEventListener('click', closeLightbox);
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeLightbox();
        });

        await loadAll();
        await loadExpenses();
        refreshPayerOptions();
        wireCostForm();
        subscribeRealtime();
      });
    })();
