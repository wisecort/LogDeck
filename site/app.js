// GitHub Pages site: highlights the visitor's OS in the download section and copies commands.
;(function () {
  const ua = navigator.userAgent
  const os = /Windows/.test(ua) ? 'win' : /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? 'mac' : /Linux|X11/.test(ua) && !/Android/.test(ua) ? 'linux' : null
  const names = { mac: 'macOS', win: 'Windows', linux: 'Linux' }

  if (os) {
    const card = document.querySelector('.os[data-os="' + os + '"]')
    if (card) {
      card.classList.add('mine')
      card.parentElement.prepend(card)
    }
    const primary = document.getElementById('primary-download')
    if (primary) primary.textContent = primary.dataset.label + ' ' + names[os]
  }

  const root = document.documentElement
  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', function () {
      const code = button.parentElement.querySelector('code')
      if (!code || !navigator.clipboard) return
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        button.textContent = root.dataset.copied
        button.classList.add('done')
        setTimeout(function () {
          button.textContent = root.dataset.copy
          button.classList.remove('done')
        }, 2000)
      })
    })
  }
})()
