// GitHub Pages site: highlights the visitor's OS, copies commands, reveals sections on scroll and plays the
// demo video only while it is on screen.
;(function () {
  const ua = navigator.userAgent
  const os = /Windows/.test(ua)
    ? 'win'
    : /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua)
      ? 'mac'
      : /Linux|X11/.test(ua) && !/Android/.test(ua)
        ? 'linux'
        : null
  const names = { mac: 'macOS', win: 'Windows', linux: 'Linux' }

  if (os) {
    const card = document.querySelector('.os[data-os="' + os + '"]')
    if (card) {
      card.classList.add('mine')
      card.parentElement.prepend(card)
    }
    const label = document.querySelector('#primary-download span')
    const primary = document.getElementById('primary-download')
    if (label && primary) label.textContent = primary.dataset.label + ' ' + names[os]
  }

  const root = document.documentElement
  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', function () {
      const code = button.parentElement.querySelector('code')
      const text = button.querySelector('span')
      if (!code || !text || !navigator.clipboard) return
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        text.textContent = root.dataset.copied
        button.classList.add('done')
        setTimeout(function () {
          text.textContent = root.dataset.copy
          button.classList.remove('done')
        }, 2000)
      })
    })
  }

  const reveals = document.querySelectorAll('.reveal')
  const video = document.querySelector('.video video')
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) {
      el.classList.add('in')
    })
    return
  }
  const seen = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          seen.unobserve(e.target)
        }
      })
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  reveals.forEach(function (el) {
    seen.observe(el)
  })

  if (video) {
    new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) video.play().catch(function () {})
          else video.pause()
        })
      },
      { threshold: 0.35 },
    ).observe(video)
  }
})()
