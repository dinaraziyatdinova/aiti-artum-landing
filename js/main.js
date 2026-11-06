/* Настройка интеграции. Здесь допустим только публичный URL обработчика.
   Секреты Telegram/API хранятся на сервере, никогда в клиентском JavaScript.
   Обработчик получает JSON и возвращает HTTP 2xx + {"success": true}.
   Для другого сервиса адаптируйте buildPayload / isSuccess ниже.
   Политика и текст согласия должны быть утверждены организатором. */
window.ARTUM_CONFIG = Object.freeze({
  endpoint: null, // Например: "/api/application" — после подключения обработчика
  privacyUrl: null, // Например: "privacy.pdf" — только предоставленный документ
  timeoutMs: 15000,
  buildPayload: (values) => values,
  isSuccess: (response, data) => response.ok && data.success === true
});

(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.ARTUM_CONFIG;
  const header = document.querySelector('.header');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.navigation');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menuBreakpoint = window.matchMedia('(min-width: 1200px)');

  const closeMenu = (restoreFocus = false) => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
    navigation.classList.remove('open');
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => {
    const opening = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.setAttribute('aria-label', opening ? 'Закрыть меню' : 'Открыть меню');
    navigation.classList.toggle('open', opening);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  menuBreakpoint.addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  // Без IntersectionObserver содержимое сразу остаётся доступным.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('visible'));
  }

  const form = document.getElementById('request-form');
  document.querySelectorAll('[data-format]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const radio = [...form.elements.format].find(input => input.value === link.dataset.format);
      if (radio) radio.checked = true;
      closeMenu();
      document.getElementById('application').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      // Переносим фокус без второго скачка страницы.
      document.getElementById('name').focus({ preventScroll: true });
      history.replaceState(null, '', '#application');
    });
  });

  let dialogTrigger = null;
  const openDialog = (dialog, trigger) => {
    dialogTrigger = trigger;
    dialog.showModal();
    document.body.classList.add('modal-open');
  };
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      if (dialogTrigger) dialogTrigger.focus({ preventScroll: true });
      dialogTrigger = null;
    });
  });
  const lightbox = document.getElementById('lightbox');
  // Видео запрашивает метаданные только при приближении к медиагалерее.
  const eventVideo = document.querySelector('.event-video video');
  if (eventVideo) {
    const loadVideo = () => {
      const source = eventVideo.querySelector('source[data-src]');
      if (!source || source.hasAttribute('src')) return;
      source.src = source.dataset.src;
      eventVideo.load();
    };
    if ('IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          loadVideo();
          videoObserver.disconnect();
        }
      }, { rootMargin: '300px' });
      videoObserver.observe(eventVideo);
    } else loadVideo();
  }
  const galleryButtons = [...document.querySelectorAll('[data-gallery]')];
  const lightboxImage = document.getElementById('lightbox-image');
  let galleryIndex = 0;
  const gallerySource = button => button.dataset.full || button.querySelector('img').getAttribute('src');
  const showGalleryPhoto = index => {
    galleryIndex = (index + galleryButtons.length) % galleryButtons.length;
    const button = galleryButtons[galleryIndex];
    lightboxImage.src = gallerySource(button);
    lightboxImage.alt = button.querySelector('img').alt;
    document.getElementById('lightbox-caption').textContent = button.dataset.caption;
    document.getElementById('lightbox-counter').textContent = `${galleryIndex + 1} из ${galleryButtons.length}`;
    // Только соседние фотографии, и только после открытия пользователем.
    [-1, 1].forEach(direction => {
      const neighbour = galleryButtons[(galleryIndex + direction + galleryButtons.length) % galleryButtons.length];
      const preload = new Image();
      preload.src = gallerySource(neighbour);
    });
  };
  galleryButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      showGalleryPhoto(index);
      openDialog(lightbox, button);
    });
  });
  lightbox.querySelector('[data-gallery-prev]').addEventListener('click', () => showGalleryPhoto(galleryIndex - 1));
  lightbox.querySelector('[data-gallery-next]').addEventListener('click', () => showGalleryPhoto(galleryIndex + 1));
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showGalleryPhoto(galleryIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let swipeStart = null;
  const lightboxStage = lightbox.querySelector('.lightbox-stage');
  lightboxStage.addEventListener('touchstart', event => {
    swipeStart = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }, { passive: true });
  lightboxStage.addEventListener('touchend', event => {
    if (!swipeStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - swipeStart.x;
    const dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showGalleryPhoto(galleryIndex + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
  lightboxStage.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
  lightbox.addEventListener('close', () => { swipeStart = null; });

  document.querySelectorAll('[data-privacy]').forEach(link => {
    if (config.privacyUrl) {
      link.href = config.privacyUrl;
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.addEventListener('click', event => {
        event.preventDefault();
        openDialog(document.getElementById('privacy-dialog'), link);
      });
    }
  });
  if (config.privacyUrl) {
    const footerLink = document.createElement('a');
    footerLink.href = config.privacyUrl;
    footerLink.textContent = 'Политика конфиденциальности';
    document.querySelector('.footer-bottom').append(footerLink);
  }

  const integrationReady = Boolean(config.endpoint && config.privacyUrl);
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.querySelector('span');
  let sending = false;
  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = 'form-status' + (type ? ' ' + type : '');
  };
  const normalizedPhone = value => {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
    return digits;
  };
  const validateField = input => {
    let error = '';
    const value = input.value.trim();
    if (input.id === 'name' && !value) error = 'Пожалуйста, укажите ваше имя.';
    if (input.id === 'group' && !value) error = 'Укажите класс и примерное количество участников.';
    if (input.id === 'phone') {
      const digits = normalizedPhone(value);
      if (!value) error = 'Укажите контактный телефон.';
      else if (!/^[+\d\s().-]+$/.test(value) || !/^7\d{10}$/.test(digits)) error = 'Введите российский номер: +7 и ещё 10 цифр.';
    }
    if (input.id === 'consent' && !input.checked) error = 'Для отправки необходимо согласие на обработку персональных данных.';
    input.setAttribute('aria-invalid', String(Boolean(error)));
    document.getElementById(input.id + '-error').textContent = error;
    return !error;
  };
  const required = ['name', 'phone', 'group', 'consent'].map(id => document.getElementById(id));
  required.forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value || input.getAttribute('aria-invalid') === 'true') validateField(input);
    });
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validateField(input);
      if (!sending && status.textContent) setStatus('');
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    setStatus('');
    const invalidFields = required.filter(input => !validateField(input));
    if (invalidFields.length) {
      setStatus('Проверьте отмеченные поля — заявка не отправлена.', 'error');
      invalidFields[0].focus();
      return;
    }
    if (!integrationReady) {
      setStatus('Заявка не отправлена: онлайн-отправка пока не подключена. Позвоните по номеру +7 977 115-62-39 — Мария Александровна поможет организовать встречу.', 'error');
      return;
    }

    const values = Object.fromEntries(new FormData(form));
    values.phone = '+' + normalizedPhone(values.phone);
    values.name = values.name.trim();
    values.group = values.group.trim();
    values.message = values.message.trim();
    values.consent = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    sending = true;
    submit.disabled = true;
    submitLabel.textContent = 'Отправляем…';
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(config.buildPayload(values)),
        signal: controller.signal,
        credentials: 'omit'
      });
      const data = await response.json();
      if (!config.isSuccess(response, data)) throw new Error('not-confirmed');
      setStatus('Спасибо! Заявка отправлена. Организатор свяжется с вами для обсуждения встречи.', 'success');
      form.reset();
      required.forEach(input => input.removeAttribute('aria-invalid'));
    } catch (error) {
      setStatus(error.name === 'AbortError'
        ? 'Не удалось получить подтверждение отправки вовремя. Ваши данные сохранены в полях. Уточните получение заявки по телефону +7 977 115-62-39 перед повторной отправкой.'
        : 'Не удалось подтвердить отправку заявки. Ваши данные сохранены в полях. Проверьте соединение или позвоните по номеру +7 977 115-62-39.', 'error');
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submitLabel.textContent = 'Отправить';
      form.removeAttribute('aria-busy');
    }
  });
  submit.disabled = false;
})();
