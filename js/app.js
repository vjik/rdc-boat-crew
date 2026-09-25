(function () {
  "use strict";

  var STORAGE_KEY = "rdc-boat-crew:v3";
  var LEGACY_STORAGE_KEY = "rdc-boat-crew:v2";
  var DEFAULT_PROFILE_NAME = "26.09.2026 Открытый класс";
  var DEFAULT_STATUS = "maybe";
  var EMPTY_BOAT_WEIGHT = 250;
  var WEIGHT_DIFF_FOR_FULL_TINT = 200;
  var WEIGHT_TINT_MIN_INTENSITY = 0.12;

  var STATUS_LIST = [
    { key: "approved", label: "Утверждено" },
    { key: "questioned", label: "Под вопросом" },
    { key: "maybe", label: "Возможно" }
  ];

  var SIDE_LIST = [
    { key: "l", label: "Л" },
    { key: null, label: "У" },
    { key: "r", label: "П" }
  ];

  var SIDE_MODAL_OPTIONS = [
    { key: "l", label: "Левый" },
    { key: null, label: "Универсал" },
    { key: "r", label: "Правый" }
  ];

  var SIDE_WARNING_LABELS = { l: "левый", r: "правый" };
  var SIDE_FULL_LABELS = { l: "левый", r: "правый" };

  var DEFAULT_ROWER_NAMES = [
    "Пре**ев", "Лап**ев", "Шма**ов", "Кли**ов", "Сте**ов",
    "Слу**ий", "Ант**ов", "Кра**ко", "Сам**ин", "Мед**ев",
    "Лих**ёв", "Дол**ко", "Ино**ев", "Лед**ёв", "Ва**ин",
    "Сол**ко", "Тим**ев", "Дав**в"
  ];

  var DEFAULT_SEAT_ASSIGNMENTS = {
    "person-1": "bank-2-l",
    "person-2": "bank-4-l",
    "person-3": "bank-6-l",
    "person-4": "bank-7-l",
    "person-5": "bank-8-l",
    "person-6": "bank-9-l",
    "person-7": "bank-10-l",
    "person-8": "bank-2-r",
    "person-9": "bank-3-r",
    "person-10": "bank-4-r",
    "person-11": "bank-5-r",
    "person-12": "bank-6-r",
    "person-13": "bank-7-r",
    "person-14": "bank-8-r",
    "person-15": "bank-9-r",
    "person-16": "bank-10-r",
    "person-18": "bank-5-l",
    "person-steer": "steer"
  };

  // Default side restriction per person id: "l" (only left), "r" (only right), or omit for "either".
  var DEFAULT_PERSON_SIDES = {
    "person-1": "l",
    "person-2": "l",
    "person-3": "l",
    "person-6": "l",
    "person-7": "l",
    "person-8": "r",
    "person-9": "r",
    "person-10": "r",
    "person-11": "r",
    "person-12": "r",
    "person-13": "r",
    "person-14": "r",
    "person-15": "r",
    "person-16": "r",
    "person-18": "l"
  };

  var SEATS = buildSeatDefinitions();
  var state = loadState();
  var activeModalSeatId = null;
  var suppressNextClick = false;
  var activeSideModalPersonId = null;

  function buildSeatDefinitions() {
    var seats = [{ id: "drummer", label: "Барабан", fullLabel: "Барабан" }];
    for (var i = 1; i <= 10; i++) {
      seats.push({ id: "bank-" + i + "-l", bankLabel: "Банка " + i, sideWord: "Лево", fullLabel: "Банка " + i + " · лево" });
      seats.push({ id: "bank-" + i + "-r", bankLabel: "Банка " + i, sideWord: "Право", fullLabel: "Банка " + i + " · право" });
    }
    seats.push({ id: "steer", label: "Руль", fullLabel: "Руль" });
    seats.push({ id: "spare-1", label: "Запасной 1", fullLabel: "Запасной 1" });
    seats.push({ id: "spare-2", label: "Запасной 2", fullLabel: "Запасной 2" });
    return seats;
  }

  function findSeat(id) {
    for (var i = 0; i < SEATS.length; i++) {
      if (SEATS[i].id === id) return SEATS[i];
    }
    return null;
  }

  function defaultPeople() {
    var people = [];
    for (var i = 1; i <= DEFAULT_ROWER_NAMES.length; i++) {
      people.push({ id: "person-" + i, name: DEFAULT_ROWER_NAMES[i - 1], weight: 80, seatId: null, status: null, side: null });
    }
    people.push({ id: "person-steer", name: "Бор**ин", weight: 80, seatId: null, status: null, side: null });

    people.forEach(function (p) {
      var seatId = DEFAULT_SEAT_ASSIGNMENTS[p.id];
      if (seatId) {
        p.seatId = seatId;
        p.status = DEFAULT_STATUS;
      }
      var side = DEFAULT_PERSON_SIDES[p.id];
      if (side) p.side = side;
    });

    return people;
  }

  function makePersonId() {
    return "person-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  function makeProfileId() {
    return "profile-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  function createProfile(name, peopleList) {
    return { id: makeProfileId(), name: name, people: peopleList || [] };
  }

  function buildInitialState() {
    // Migrate a pre-profiles save (single flat people list) into the default profile
    // instead of discarding it, if one exists.
    var initialPeople = null;
    try {
      var legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        var legacyParsed = JSON.parse(legacyRaw);
        if (legacyParsed && Array.isArray(legacyParsed.people)) initialPeople = legacyParsed.people;
      }
    } catch (e) {
      // ignore, fall back to defaults below
    }

    var profile = createProfile(DEFAULT_PROFILE_NAME, initialPeople || defaultPeople());
    return { activeProfileId: profile.id, profiles: [profile] };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length && parsed.activeProfileId) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Не удалось прочитать сохранённые данные", e);
    }
    return buildInitialState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Не удалось сохранить данные", e);
    }
  }

  function findProfile(id) {
    for (var i = 0; i < state.profiles.length; i++) {
      if (state.profiles[i].id === id) return state.profiles[i];
    }
    return null;
  }

  function activeProfile() {
    return findProfile(state.activeProfileId) || state.profiles[0];
  }

  function activePeople() {
    return activeProfile().people;
  }

  function addProfile(name, importFromProfileId) {
    var peopleList = [];
    if (importFromProfileId) {
      var source = findProfile(importFromProfileId);
      if (source) {
        peopleList = source.people.map(function (p) {
          return { id: makePersonId(), name: p.name, weight: p.weight, side: p.side || null, seatId: null, status: null };
        });
      }
    }
    var profile = createProfile(name, peopleList);
    state.profiles.push(profile);
    state.activeProfileId = profile.id;
    saveState();
    return profile;
  }

  function deleteProfile(id) {
    if (state.profiles.length <= 1) return false;
    state.profiles = state.profiles.filter(function (p) { return p.id !== id; });
    if (state.activeProfileId === id) state.activeProfileId = state.profiles[0].id;
    saveState();
    return true;
  }

  function renameProfile(id, name) {
    var profile = findProfile(id);
    if (!profile) return;
    var trimmed = name.trim();
    profile.name = trimmed || profile.name;
    saveState();
  }

  function switchProfile(id) {
    if (!findProfile(id) || id === state.activeProfileId) return;
    state.activeProfileId = id;
    saveState();
    renderProfileButton();
    renderBoat();
  }

  function findPerson(id) {
    var people = activePeople();
    for (var i = 0; i < people.length; i++) {
      if (people[i].id === id) return people[i];
    }
    return null;
  }

  function findOccupant(seatId) {
    var people = activePeople();
    for (var i = 0; i < people.length; i++) {
      if (people[i].seatId === seatId) return people[i];
    }
    return null;
  }

  function assignPersonToSeat(personId, seatId) {
    var person = findPerson(personId);
    if (!person) return;
    activePeople().forEach(function (other) {
      if (other.seatId === seatId && other.id !== personId) {
        other.seatId = null;
        other.status = null;
      }
    });
    person.seatId = seatId;
    if (!person.status) person.status = DEFAULT_STATUS;
    saveState();
  }

  function unassignPerson(personId) {
    var person = findPerson(personId);
    if (!person) return;
    person.seatId = null;
    person.status = null;
    saveState();
  }

  function setStatus(personId, status) {
    var person = findPerson(personId);
    if (!person || !person.seatId) return;
    person.status = status;
    saveState();
  }

  function getSeatSide(seatId) {
    if (/-l$/.test(seatId)) return "l";
    if (/-r$/.test(seatId)) return "r";
    return null;
  }

  function parseBankNumber(seatId) {
    var m = /^bank-(\d+)-[lr]$/.exec(seatId);
    return m ? parseInt(m[1], 10) : null;
  }

  function cascadeShift(side, fromSeatId, toSeatId) {
    var fromIdx = parseBankNumber(fromSeatId);
    var toIdx = parseBankNumber(toSeatId);
    if (fromIdx === null || toIdx === null) return;
    var dir = fromIdx > toIdx ? 1 : -1;

    var carry = findOccupant(toSeatId);
    while (carry) {
      var currentIdx = parseBankNumber(carry.seatId);
      var nextIdx = currentIdx + dir;
      var nextSeatId = "bank-" + nextIdx + "-" + side;
      var nextOccupant = nextIdx === fromIdx ? null : findOccupant(nextSeatId);
      carry.seatId = nextSeatId;
      carry = nextOccupant;
    }
  }

  // Nearest empty bank seat index on `side` around `aroundIdx` (ties broken towards bank 1).
  function findNearestEmptyBankIdx(side, aroundIdx) {
    for (var d = 1; d <= 10; d++) {
      var down = aroundIdx - d;
      if (down >= 1 && !findOccupant("bank-" + down + "-" + side)) return down;
      var up = aroundIdx + d;
      if (up <= 10 && !findOccupant("bank-" + up + "-" + side)) return up;
    }
    return null;
  }

  function handleSeatDrop(sourcePersonId, sourceSeatId, targetSeatId) {
    if (!targetSeatId || sourceSeatId === targetSeatId) return;
    var sourcePerson = findPerson(sourcePersonId);
    if (!sourcePerson || sourcePerson.seatId !== sourceSeatId) return;

    var sourceSide = getSeatSide(sourceSeatId);
    var targetSide = getSeatSide(targetSeatId);
    var targetOccupant = findOccupant(targetSeatId);

    if (sourceSide && targetSide && sourceSide === targetSide) {
      if (targetOccupant) cascadeShift(sourceSide, sourceSeatId, targetSeatId);
      sourcePerson.seatId = targetSeatId;
      saveState();
    } else if (sourceSide && targetSide && sourceSide !== targetSide) {
      // Moving to the other side: shift the chain on that side to make room when possible,
      // and only bump the occupant off the boat when there's truly no free seat to shift into.
      if (targetOccupant) {
        var emptyIdx = findNearestEmptyBankIdx(targetSide, parseBankNumber(targetSeatId));
        if (emptyIdx !== null) {
          cascadeShift(targetSide, "bank-" + emptyIdx + "-" + targetSide, targetSeatId);
          sourcePerson.seatId = targetSeatId;
          saveState();
        } else {
          assignPersonToSeat(sourcePersonId, targetSeatId);
        }
      } else {
        sourcePerson.seatId = targetSeatId;
        saveState();
      }
    } else if (sourceSide === null && targetSide === null) {
      if (targetOccupant) targetOccupant.seatId = sourceSeatId;
      sourcePerson.seatId = targetSeatId;
      saveState();
    } else {
      assignPersonToSeat(sourcePersonId, targetSeatId);
    }
    renderBoat();
  }

  function addPerson() {
    var id = makePersonId();
    activePeople().push({ id: id, name: "Новый участник", weight: 80, seatId: null, status: null, side: null });
    saveState();
    renderPeopleModal();
    requestAnimationFrame(function () {
      var input = document.querySelector('[data-person-id="' + id + '"] .person-name');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function deletePerson(id) {
    var profile = activeProfile();
    profile.people = profile.people.filter(function (p) { return p.id !== id; });
    saveState();
    renderBoat();
    renderPeopleModal();
  }

  /* ===== Rendering: boat ===== */

  function render() {
    renderProfileButton();
    renderBoat();
  }

  function computeWeights() {
    var left = 0, right = 0, total = 0;
    activePeople().forEach(function (p) {
      if (!p.seatId) return;
      total += p.weight;
      if (/-l$/.test(p.seatId)) left += p.weight;
      else if (/-r$/.test(p.seatId)) right += p.weight;
    });
    return { left: left, right: right, total: total + EMPTY_BOAT_WEIGHT };
  }

  function applyTint(el, tintClassPrefix, kind, intensity) {
    el.classList.remove(tintClassPrefix + "--heavy", tintClassPrefix + "--light");
    if (kind) {
      el.classList.add(tintClassPrefix + "--" + kind);
      el.style.setProperty("--tint-alpha", intensity.toFixed(2));
    } else {
      el.style.removeProperty("--tint-alpha");
    }
  }

  function renderWeights() {
    var w = computeWeights();
    document.getElementById("weight-left-value").textContent = w.left + " кг";
    document.getElementById("weight-right-value").textContent = w.right + " кг";
    document.getElementById("weight-total-value").textContent = w.total + " кг";

    var diff = w.left - w.right;
    var ratio = Math.min(Math.abs(diff), WEIGHT_DIFF_FOR_FULL_TINT) / WEIGHT_DIFF_FOR_FULL_TINT;
    var intensity = diff === 0 ? 0 : WEIGHT_TINT_MIN_INTENSITY + ratio * (1 - WEIGHT_TINT_MIN_INTENSITY);
    var leftKind = diff > 0 ? "heavy" : (diff < 0 ? "light" : null);
    var rightKind = diff < 0 ? "heavy" : (diff > 0 ? "light" : null);

    applyTint(document.getElementById("weight-left"), "weight-item", leftKind, intensity);
    applyTint(document.getElementById("weight-right"), "weight-item", rightKind, intensity);

    var sideLeft = document.getElementById("side-tint-left");
    var sideRight = document.getElementById("side-tint-right");
    if (sideLeft) applyTint(sideLeft, "side-tint", leftKind, intensity);
    if (sideRight) applyTint(sideRight, "side-tint", rightKind, intensity);
  }

  function renderBoat() {
    var hull = document.getElementById("boat-hull");
    hull.innerHTML = "";

    var sideLeft = document.createElement("div");
    sideLeft.id = "side-tint-left";
    sideLeft.className = "side-tint side-tint--left";
    hull.appendChild(sideLeft);

    var sideRight = document.createElement("div");
    sideRight.id = "side-tint-right";
    sideRight.className = "side-tint side-tint--right";
    hull.appendChild(sideRight);

    hull.appendChild(renderSeatSlot(findSeat("drummer")));

    var rowsWrap = document.createElement("div");
    rowsWrap.className = "boat-rows";

    for (var i = 1; i <= 10; i++) {
      var rowEl = document.createElement("div");
      rowEl.className = "boat-row";
      rowEl.appendChild(renderSeatSlot(findSeat("bank-" + i + "-l")));
      rowEl.appendChild(renderSeatSlot(findSeat("bank-" + i + "-r")));
      rowsWrap.appendChild(rowEl);
    }
    hull.appendChild(rowsWrap);
    hull.appendChild(renderSeatSlot(findSeat("steer")));

    var spareTitle = document.createElement("div");
    spareTitle.className = "spare-row-title";
    spareTitle.textContent = "Запасные";
    hull.appendChild(spareTitle);

    var spareRow = document.createElement("div");
    spareRow.className = "boat-row";
    spareRow.appendChild(renderSeatSlot(findSeat("spare-1")));
    spareRow.appendChild(renderSeatSlot(findSeat("spare-2")));
    hull.appendChild(spareRow);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.id = "copy-crew";
    copyBtn.className = "copy-crew-btn";
    copyBtn.textContent = "Скопировать состав";
    copyBtn.addEventListener("click", copyCrew);
    hull.appendChild(copyBtn);

    renderWeights();
  }

  function buildCrewText() {
    var lines = [activeProfile().name];
    for (var i = 1; i <= 10; i++) {
      var left = findOccupant("bank-" + i + "-l");
      var right = findOccupant("bank-" + i + "-r");
      lines.push(i + ". " + (left ? left.name : "…") + " — " + (right ? right.name : "…"));
    }
    var drummer = findOccupant("drummer");
    var steer = findOccupant("steer");
    var spare1 = findOccupant("spare-1");
    var spare2 = findOccupant("spare-2");
    lines.push("Барабан — " + (drummer ? drummer.name : "…"));
    lines.push("Рулевой — " + (steer ? steer.name : "…"));
    var spareNames = [spare1, spare2].filter(function (p) { return !!p; }).map(function (p) { return p.name; });
    lines.push(spareNames.length ? "Запасные — " + spareNames.join(", ") : "Без запасных");
    return lines.join("\n");
  }

  function copyCrew() {
    var text = buildCrewText();
    var copied = function () { showCopySuccess(); };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(copied).catch(function () {
        copyCrewFallback(text, copied);
      });
    } else {
      copyCrewFallback(text, copied);
    }
  }

  function copyCrewFallback(text, callback) {
    var area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.focus();
    area.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    area.remove();
    callback();
  }

  function showCopySuccess() {
    var overlay = document.getElementById("copy-success");
    var message = overlay.querySelector(".copy-success-message");
    var canvas = document.getElementById("copy-success-canvas");
    var ctx = canvas.getContext("2d");
    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    overlay.hidden = false;
    overlay.classList.remove("copy-success--leaving");
    message.classList.remove("copy-success-message--leaving");

    var explosion = createExplosion(width / 2, height / 2);
    var start = performance.now();
    var raf;
    function frame(now) {
      var elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      drawExplosion(ctx, explosion, elapsed, 1450, width, height);
      if (elapsed < 1700) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Fade the message out alongside the explosion. A separate frame ensures it is
    // painted visibly before the transition starts.
    requestAnimationFrame(function () {
      message.style.setProperty("transition", "opacity 1.45s ease, transform 1.45s ease", "important");
      message.style.setProperty("transform", "scale(0.96)", "important");
      message.style.setProperty("opacity", "0");
    });

    window.setTimeout(function () {
      overlay.classList.add("copy-success--leaving");
      window.setTimeout(function () {
        if (raf) cancelAnimationFrame(raf);
        overlay.hidden = true;
      }, 700);
    }, 500);
  }

  function renderSeatSlot(seatDef) {
    var occupant = findOccupant(seatDef.id);
    var seatSide = getSeatSide(seatDef.id);
    var sideMismatch = !!(occupant && occupant.side && seatSide && occupant.side !== seatSide);

    var wrap = document.createElement("div");
    wrap.className = "seat-slot";

    var bankIdx = parseBankNumber(seatDef.id);
    if (bankIdx !== null) {
      var bankNum = document.createElement("span");
      bankNum.className = "bank-number bank-number--" + seatSide;
      bankNum.textContent = bankIdx;
      bankNum.setAttribute("aria-hidden", "true");
      wrap.appendChild(bankNum);
    }

    var seat = document.createElement("div");
    seat.className = "seat" + (occupant ? " seat--filled" : "");
    if (occupant && occupant.status) seat.classList.add("seat--" + occupant.status);
    if (sideMismatch) seat.classList.add("seat--side-mismatch");
    seat.dataset.seatId = seatDef.id;
    seat.title = seatDef.fullLabel;

    var mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "seat-main";
    mainBtn.setAttribute("aria-label", seatDef.fullLabel + (occupant ? ": " + occupant.name + " — выбрать человека" : ": свободно — выбрать человека"));

    if (occupant) {
      var nameSpan = document.createElement("span");
      nameSpan.className = "seat-name";
      nameSpan.textContent = occupant.name;
      mainBtn.appendChild(nameSpan);

      var weightSpan = document.createElement("span");
      weightSpan.className = "seat-weight";
      weightSpan.textContent = occupant.weight + " кг";
      mainBtn.appendChild(weightSpan);

      if (sideMismatch) {
        var warnSpan = document.createElement("span");
        warnSpan.className = "seat-side-warning";
        warnSpan.textContent = SIDE_WARNING_LABELS[occupant.side];
        mainBtn.appendChild(warnSpan);
      }
    } else if (seatDef.bankLabel) {
      var bankLine = document.createElement("span");
      bankLine.className = "seat-label-line";
      bankLine.textContent = seatDef.bankLabel;
      mainBtn.appendChild(bankLine);

      var sideLine = document.createElement("span");
      sideLine.className = "seat-label-line seat-label-line--side";
      sideLine.textContent = seatDef.sideWord;
      mainBtn.appendChild(sideLine);
    } else {
      var labelSpan = document.createElement("span");
      labelSpan.className = "seat-label";
      labelSpan.textContent = seatDef.label;
      mainBtn.appendChild(labelSpan);
    }

    mainBtn.addEventListener("click", function () {
      if (suppressNextClick) { suppressNextClick = false; return; }
      openSeatModal(seatDef.id);
    });
    if (occupant) attachSeatDrag(mainBtn, seat, seatDef.id, occupant.id);
    seat.appendChild(mainBtn);

    wrap.appendChild(seat);
    return wrap;
  }

  function positionGhost(ghost, x, y) {
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
  }

  function attachSeatDrag(mainBtn, seatEl, sourceSeatId, personId) {
    mainBtn.addEventListener("pointerdown", function (e) {
      var startX = e.clientX, startY = e.clientY;
      var dragging = false;
      var ghost = null;
      var hoverSeatEl = null;

      function onMove(ev) {
        var dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!dragging) {
          if (Math.hypot(dx, dy) < 6) return;
          dragging = true;
          var rect = seatEl.getBoundingClientRect();
          ghost = seatEl.cloneNode(true);
          ghost.classList.add("drag-ghost");
          ghost.style.width = rect.width + "px";
          ghost.style.height = rect.height + "px";
          document.body.appendChild(ghost);
          seatEl.classList.add("seat--dragging-source");
          document.body.classList.add("is-dragging");
        }
        ev.preventDefault();
        positionGhost(ghost, ev.clientX, ev.clientY);
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var seatUnderPointer = target ? target.closest(".seat") : null;
        if (hoverSeatEl && hoverSeatEl !== seatUnderPointer) hoverSeatEl.classList.remove("seat--drag-hover");
        if (seatUnderPointer && seatUnderPointer !== seatEl) seatUnderPointer.classList.add("seat--drag-hover");
        hoverSeatEl = seatUnderPointer;
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (!dragging) return;
        if (hoverSeatEl) hoverSeatEl.classList.remove("seat--drag-hover");
        if (ghost) ghost.remove();
        seatEl.classList.remove("seat--dragging-source");
        document.body.classList.remove("is-dragging");
        suppressNextClick = true;

        if (hoverSeatEl && hoverSeatEl !== seatEl) {
          handleSeatDrop(personId, sourceSeatId, hoverSeatEl.dataset.seatId);
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  /* ===== Seat modal ===== */

  function openSeatModal(seatId) {
    activeModalSeatId = seatId;
    renderSeatModal();
    document.getElementById("seat-modal").hidden = false;
  }

  function closeSeatModal() {
    activeModalSeatId = null;
    document.getElementById("seat-modal").hidden = true;
  }

  function renderSeatModal() {
    if (!activeModalSeatId) return;
    var seatDef = findSeat(activeModalSeatId);
    if (!seatDef) return;

    document.getElementById("seat-modal-title").textContent = seatDef.fullLabel;

    var occupant = findOccupant(seatDef.id);
    var currentWrap = document.getElementById("seat-modal-current");
    currentWrap.innerHTML = "";

    if (occupant) {
      var personRow = document.createElement("div");
      personRow.className = "modal-current-person";
      var nameSpan = document.createElement("span");
      nameSpan.className = "modal-current-name";
      nameSpan.textContent = occupant.name;
      personRow.appendChild(nameSpan);
      var weightSpan = document.createElement("span");
      weightSpan.className = "modal-current-weight";
      weightSpan.textContent = occupant.weight + " кг · " + sideFullLabel(occupant.side);
      personRow.appendChild(weightSpan);
      currentWrap.appendChild(personRow);

      var statusRow = document.createElement("div");
      statusRow.className = "status-row";
      STATUS_LIST.forEach(function (s) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "status-dot status-dot--" + s.key + (occupant.status === s.key ? " is-active" : "");
        btn.textContent = s.label;
        btn.addEventListener("click", function (statusKey) {
          return function () {
            setStatus(occupant.id, statusKey);
            renderBoat();
            closeSeatModal();
          };
        }(s.key));
        statusRow.appendChild(btn);
      });
      currentWrap.appendChild(statusRow);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-remove-seat";
      removeBtn.textContent = "Убрать с места";
      removeBtn.addEventListener("click", function () {
        unassignPerson(occupant.id);
        renderBoat();
        closeSeatModal();
      });
      currentWrap.appendChild(removeBtn);
    } else {
      var empty = document.createElement("p");
      empty.className = "modal-current-empty";
      empty.textContent = "Место свободно";
      currentWrap.appendChild(empty);
    }

    var list = document.getElementById("seat-modal-list");
    list.innerHTML = "";
    var freePeople = activePeople().filter(function (p) { return !p.seatId; });
    if (freePeople.length === 0) {
      var emptyList = document.createElement("p");
      emptyList.className = "modal-current-empty";
      emptyList.textContent = "Нет свободных участников";
      list.appendChild(emptyList);
    } else {
      freePeople.forEach(function (person) {
        list.appendChild(renderSeatPickRow(person, seatDef));
      });
    }
  }

  function renderSeatPickRow(person, seatDef) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "modal-row modal-row--pick";
    btn.dataset.personId = person.id;

    var nameSpan = document.createElement("span");
    nameSpan.className = "modal-row-pick-name";
    nameSpan.textContent = person.name;
    btn.appendChild(nameSpan);

    var weightSpan = document.createElement("span");
    weightSpan.className = "modal-row-pick-weight";
    weightSpan.textContent = person.weight + " кг · " + sideFullLabel(person.side);
    btn.appendChild(weightSpan);

    btn.addEventListener("click", function () {
      assignPersonToSeat(person.id, seatDef.id);
      renderBoat();
      closeSeatModal();
    });

    return btn;
  }

  /* ===== Profile modal ===== */

  function renderProfileButton() {
    var btn = document.getElementById("open-profile");
    if (btn) btn.textContent = activeProfile().name;
  }

  function openProfileModal() {
    renderProfileModal();
    document.getElementById("profile-modal").hidden = false;
  }

  function closeProfileModal() {
    document.getElementById("profile-modal").hidden = true;
  }

  function renderProfileModal() {
    var list = document.getElementById("profile-modal-list");
    list.innerHTML = "";
    state.profiles.forEach(function (profile) {
      list.appendChild(renderProfileRow(profile));
    });
  }

  function renderProfileImportSelect() {
    var select = document.getElementById("profile-import-from");
    select.innerHTML = "";

    var noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "Не импортировать";
    select.appendChild(noneOpt);

    state.profiles.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  }

  function openProfileCreateModal() {
    document.getElementById("profile-new-name").value = "";
    renderProfileImportSelect();
    document.getElementById("profile-create-modal").hidden = false;
    document.getElementById("profile-new-name").focus();
  }

  function closeProfileCreateModal() {
    document.getElementById("profile-create-modal").hidden = true;
  }

  function renderProfileRow(profile) {
    var row = document.createElement("div");
    row.className = "modal-row";
    row.dataset.profileId = profile.id;

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "person-name";
    nameInput.value = profile.name;
    nameInput.maxLength = 60;
    nameInput.setAttribute("aria-label", "Название профиля");
    nameInput.setAttribute("autocomplete", "off");
    nameInput.addEventListener("change", function () {
      renameProfile(profile.id, nameInput.value);
      nameInput.value = profile.name;
      if (profile.id === state.activeProfileId) renderProfileButton();
    });
    row.appendChild(nameInput);

    if (profile.id === state.activeProfileId) {
      var badge = document.createElement("span");
      badge.className = "profile-badge";
      badge.textContent = "Текущий";
      row.appendChild(badge);
    } else {
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "profile-open-btn";
      openBtn.textContent = "Открыть";
      openBtn.addEventListener("click", function () {
        switchProfile(profile.id);
        closeProfileModal();
      });
      row.appendChild(openBtn);
    }

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "modal-row-delete";
    delBtn.setAttribute("aria-label", "Удалить профиль");
    delBtn.textContent = "✕";
    delBtn.hidden = state.profiles.length <= 1;
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm('Удалить профиль «' + profile.name + '»? Все его данные (люди и рассадка) будут потеряны.')) {
        var wasActive = profile.id === state.activeProfileId;
        deleteProfile(profile.id);
        renderProfileModal();
        if (wasActive) {
          renderProfileButton();
          renderBoat();
        }
      }
    });
    row.appendChild(delBtn);

    return row;
  }

  /* ===== People modal ===== */

  function openPeopleModal() {
    renderPeopleModal();
    document.getElementById("people-modal").hidden = false;
  }

  function closePeopleModal() {
    document.getElementById("people-modal").hidden = true;
  }

  function renderPeopleModal() {
    var list = document.getElementById("people-modal-list");
    list.innerHTML = "";
    var people = activePeople();
    if (people.length === 0) {
      var empty = document.createElement("p");
      empty.className = "modal-current-empty";
      empty.textContent = "Список пуст";
      list.appendChild(empty);
      return;
    }
    people.forEach(function (person) {
      list.appendChild(renderPersonRow(person));
    });
  }

  function sideLabel(side) {
    var found = SIDE_LIST.filter(function (s) { return (s.key || null) === (side || null); })[0];
    return found ? found.label : "У";
  }

  function sideFullLabel(side) {
    return SIDE_FULL_LABELS[side] || "универсал";
  }

  function renderSideSelectButton(person) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "side-select-btn";
    btn.textContent = sideLabel(person.side);
    btn.setAttribute("aria-label", "Борт: " + sideLabel(person.side));
    btn.addEventListener("click", function () {
      openSideModal(person.id);
    });
    return btn;
  }

  /* ===== Side modal ===== */

  function openSideModal(personId) {
    activeSideModalPersonId = personId;
    renderSideModal();
    document.getElementById("side-modal").hidden = false;
  }

  function closeSideModal() {
    activeSideModalPersonId = null;
    document.getElementById("side-modal").hidden = true;
  }

  function renderSideModal() {
    var person = findPerson(activeSideModalPersonId);
    if (!person) return;

    document.getElementById("side-modal-title").textContent = person.name;

    var list = document.getElementById("side-modal-list");
    list.innerHTML = "";
    var current = person.side || null;

    SIDE_MODAL_OPTIONS.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "modal-row modal-row--pick" + (current === opt.key ? " is-active" : "");

      var label = document.createElement("span");
      label.className = "modal-row-pick-name";
      label.textContent = opt.label;
      btn.appendChild(label);

      btn.addEventListener("click", function () {
        person.side = opt.key;
        saveState();
        renderBoat();
        renderPeopleModal();
        closeSideModal();
      });

      list.appendChild(btn);
    });
  }

  function renderPersonRow(person) {
    var row = document.createElement("div");
    row.className = "modal-row";
    row.dataset.personId = person.id;

    var fields = document.createElement("div");
    fields.className = "modal-row-fields";

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "person-name";
    nameInput.id = person.id + "-name";
    nameInput.name = person.id + "-name";
    nameInput.value = person.name;
    nameInput.maxLength = 40;
    nameInput.setAttribute("aria-label", "Имя");
    nameInput.setAttribute("autocomplete", "off");
    nameInput.addEventListener("change", function () {
      var value = nameInput.value.trim();
      person.name = value || person.name;
      nameInput.value = person.name;
      saveState();
      renderBoat();
    });
    fields.appendChild(nameInput);

    var weightWrap = document.createElement("label");
    weightWrap.className = "person-weight-wrap";
    var weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.className = "person-weight";
    weightInput.id = person.id + "-weight";
    weightInput.name = person.id + "-weight";
    weightInput.value = person.weight;
    weightInput.min = "20";
    weightInput.max = "200";
    weightInput.setAttribute("aria-label", "Вес, кг");
    weightInput.setAttribute("autocomplete", "off");
    weightInput.addEventListener("change", function () {
      var value = parseInt(weightInput.value, 10);
      if (!isFinite(value) || value <= 0) value = person.weight;
      value = Math.min(200, Math.max(20, value));
      person.weight = value;
      weightInput.value = value;
      saveState();
      renderBoat();
    });
    weightWrap.appendChild(weightInput);
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "кг";
    weightWrap.appendChild(unit);
    fields.appendChild(weightWrap);

    row.appendChild(fields);
    row.appendChild(renderSideSelectButton(person));

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "modal-row-delete";
    delBtn.setAttribute("aria-label", "Удалить участника");
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm('Удалить «' + person.name + '» из списка?')) {
        deletePerson(person.id);
      }
    });
    row.appendChild(delBtn);

    return row;
  }

  /* ===== Intro ===== */

  function createExplosion(x, y) {
    var particles = [];
    for (var i = 0; i < 110; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        speed: 2.5 + Math.random() * 9,
        r: 1.5 + Math.random() * 4
      });
    }
    return { x: x, y: y, particles: particles };
  }

  function drawExplosion(ctx, explosion, elapsed, durationMs, width, height) {
    var p = Math.min(elapsed / durationMs, 1);
    var maxR = Math.hypot(width, height) * 0.62;

    var flashR = 10 + p * maxR;
    var flashAlpha = Math.max(0, 1 - p * 1.1);
    var grad = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, flashR);
    grad.addColorStop(0, "rgba(255,255,255," + (flashAlpha * 0.95) + ")");
    grad.addColorStop(0.35, "rgba(150,220,255," + (flashAlpha * 0.6) + ")");
    grad.addColorStop(0.7, "rgba(120,90,255," + (flashAlpha * 0.3) + ")");
    grad.addColorStop(1, "rgba(74,227,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    [0, 0.1, 0.2, 0.32].forEach(function (delay) {
      var rp = Math.max(0, Math.min((elapsed - delay * durationMs) / (durationMs * 0.75), 1));
      if (rp <= 0) return;
      var r = 10 + rp * maxR * 0.9;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(74,227,255," + ((1 - rp) * 0.65) + ")";
      ctx.lineWidth = Math.max(1, 6 * (1 - rp));
      ctx.stroke();
    });

    explosion.particles.forEach(function (pt) {
      var dist = pt.speed * elapsed * 0.16;
      var px = explosion.x + Math.cos(pt.angle) * dist;
      var py = explosion.y + Math.sin(pt.angle) * dist;
      var alpha = Math.max(0, 1 - p);
      ctx.beginPath();
      ctx.arc(px, py, pt.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235,250,255," + alpha + ")";
      ctx.shadowColor = "rgba(74,227,255,0.8)";
      ctx.shadowBlur = 10;
      ctx.fill();
    });
  }

  function initIntro() {
    var introEl = document.getElementById("intro");
    var skipBtn = document.getElementById("intro-skip");
    var canvas = document.getElementById("intro-canvas");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      finish(true);
      return;
    }

    var ctx = canvas.getContext("2d");
    var raf = null;
    var width = 0, height = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    resize();
    window.addEventListener("resize", resize);

    var bubbles = [];
    for (var i = 0; i < 42; i++) bubbles.push(spawnBubble());

    function spawnBubble() {
      return {
        x: Math.random() * width,
        y: height + Math.random() * height,
        r: 1 + Math.random() * 2.6,
        speed: 0.3 + Math.random() * 0.9,
        drift: Math.random() * 0.6 - 0.3,
        phase: Math.random() * Math.PI * 2
      };
    }

    var waves = [
      { amp: 20, len: 260, speed: 0.012, phase: 0, y: 0.70, color: "rgba(74,227,255,0.32)" },
      { amp: 30, len: 340, speed: 0.009, phase: 2.1, y: 0.80, color: "rgba(150,110,255,0.24)" },
      { amp: 14, len: 170, speed: 0.020, phase: 4.2, y: 0.90, color: "rgba(74,227,255,0.16)" }
    ];

    var EXPLOSION_START = 2000;
    var EXPLOSION_MS = 1950;
    var AUTO_FINISH_MS = EXPLOSION_START + EXPLOSION_MS * 0.7;

    var t = 0;
    var startTs = performance.now();
    var explosion = null;

    function frame() {
      t += 1;
      var elapsed = performance.now() - startTs;
      ctx.clearRect(0, 0, width, height);

      waves.forEach(function (w) {
        ctx.beginPath();
        var baseY = height * w.y;
        ctx.moveTo(0, baseY);
        for (var x = 0; x <= width; x += 8) {
          var y = baseY + Math.sin(x / w.len * Math.PI * 2 + w.phase + t * w.speed) * w.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = w.color;
        ctx.fill();
      });

      ctx.fillStyle = "rgba(200,240,255,0.55)";
      bubbles.forEach(function (b) {
        b.y -= b.speed;
        b.x += Math.sin(t * 0.02 + b.phase) * b.drift;
        if (b.y < -10) {
          b.y = height + 10;
          b.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      if (elapsed >= EXPLOSION_START) {
        if (!explosion) explosion = createExplosion(width / 2, height / 2);
        drawExplosion(ctx, explosion, elapsed - EXPLOSION_START, EXPLOSION_MS, width, height);
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    var timer = window.setTimeout(function () { finish(false); }, AUTO_FINISH_MS);

    skipBtn.addEventListener("click", function () { finish(false); });

    function finish(immediate) {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);

      if (immediate) {
        if (raf) cancelAnimationFrame(raf);
        introEl.remove();
        revealApp();
        return;
      }
      // Keep rendering the explosion while the intro fades out, so the fireworks
      // disappear together with the intro instead of stopping abruptly.
      introEl.classList.add("intro--leaving");
      introEl.addEventListener("transitionend", function () {
        if (raf) cancelAnimationFrame(raf);
        introEl.remove();
      }, { once: true });
      revealApp();
    }
  }

  function revealApp() {
    var appEl = document.getElementById("app");
    appEl.hidden = false;
    requestAnimationFrame(function () { appEl.classList.add("app--visible"); });
  }

  /* ===== Service worker ===== */

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("service-worker.js").catch(function () {});
      });
    }
  }

  /* ===== PWA install ===== */

  function initInstallPrompt() {
    var btn = document.getElementById("install-pwa");
    if (!btn) return;

    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) return;

    var isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    var deferredPrompt = null;

    if (isIOS) btn.hidden = false;

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.hidden = false;
    });

    window.addEventListener("appinstalled", function () {
      btn.hidden = true;
      deferredPrompt = null;
    });

    btn.addEventListener("click", function () {
      if (deferredPrompt) {
        var prompted = deferredPrompt;
        deferredPrompt = null;
        prompted.prompt();
        prompted.userChoice.finally(function () { btn.hidden = true; });
        return;
      }
      if (isIOS) {
        document.getElementById("install-hint-modal").hidden = false;
      }
    });

    document.getElementById("install-hint-close").addEventListener("click", function () {
      document.getElementById("install-hint-modal").hidden = true;
    });
    document.getElementById("install-hint-modal").addEventListener("click", function (e) {
      if (e.target.id === "install-hint-modal") e.currentTarget.hidden = true;
    });
  }

  /* ===== Init ===== */

  document.addEventListener("DOMContentLoaded", function () {
    render();

    document.getElementById("seat-modal-close").addEventListener("click", closeSeatModal);
    document.getElementById("seat-modal").addEventListener("click", function (e) {
      if (e.target.id === "seat-modal") closeSeatModal();
    });

    document.getElementById("open-people").addEventListener("click", openPeopleModal);
    document.getElementById("people-modal-close").addEventListener("click", closePeopleModal);
    document.getElementById("people-add-person").addEventListener("click", addPerson);
    document.getElementById("people-modal").addEventListener("click", function (e) {
      if (e.target.id === "people-modal") closePeopleModal();
    });

    document.getElementById("side-modal-close").addEventListener("click", closeSideModal);
    document.getElementById("side-modal").addEventListener("click", function (e) {
      if (e.target.id === "side-modal") closeSideModal();
    });

    document.getElementById("open-profile").addEventListener("click", openProfileModal);
    document.getElementById("profile-modal-close").addEventListener("click", closeProfileModal);
    document.getElementById("profile-modal").addEventListener("click", function (e) {
      if (e.target.id === "profile-modal") closeProfileModal();
    });

    document.getElementById("profile-add").addEventListener("click", openProfileCreateModal);
    document.getElementById("profile-create-close").addEventListener("click", closeProfileCreateModal);
    document.getElementById("profile-create-modal").addEventListener("click", function (e) {
      if (e.target.id === "profile-create-modal") closeProfileCreateModal();
    });
    document.getElementById("profile-create-btn").addEventListener("click", function () {
      var nameInput = document.getElementById("profile-new-name");
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      var importFromId = document.getElementById("profile-import-from").value || null;
      addProfile(name, importFromId);
      closeProfileCreateModal();
      renderProfileButton();
      renderBoat();
      renderProfileModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (activeSideModalPersonId) { closeSideModal(); return; }
      if (!document.getElementById("profile-create-modal").hidden) { closeProfileCreateModal(); return; }
      if (activeModalSeatId) closeSeatModal();
      if (!document.getElementById("people-modal").hidden) closePeopleModal();
      if (!document.getElementById("profile-modal").hidden) closeProfileModal();
    });

    initIntro();
    registerServiceWorker();
    initInstallPrompt();
  });
})();
