(function () {
  'use strict'

  var status = document.querySelector('[data-copy-status]')
  var buttons = document.querySelectorAll('[data-copy-target]')
  var canCopy = navigator.clipboard && typeof navigator.clipboard.writeText === 'function'

  if (!canCopy) return

  Array.prototype.forEach.call(buttons, function (button) {
    button.hidden = false
    button.addEventListener('click', function () {
      var target = document.getElementById(button.getAttribute('data-copy-target'))
      if (!target) return

      navigator.clipboard.writeText(target.textContent).then(function () {
        button.textContent = 'Copied'
        if (status) status.textContent = 'Install command copied to the clipboard.'
        window.setTimeout(function () {
          button.textContent = 'Copy'
        }, 1800)
      }, function () {
        if (status) status.textContent = 'Copy was unavailable. Select the command text manually.'
      })
    })
  })
}())
