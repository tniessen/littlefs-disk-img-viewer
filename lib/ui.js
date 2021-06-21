'use strict';

function $(tagName, classList, attr) {
  const elem = document.createElement(tagName);

  if (Array.isArray(classList)) {
    elem.classList.add(...classList);
  } else {
    attr = classList;
  }

  if (typeof attr === 'object') {
    for (const key of Object.getOwnPropertyNames(attr)) {
      elem.setAttribute(key, attr[key]);
    }
  }

  return elem;
}

$.svg = function(tagName, attr) {
  const elem = document.createElementNS('http://www.w3.org/2000/svg', tagName);

  if (typeof attr === 'object') {
    for (const key of Object.getOwnPropertyNames(attr)) {
      elem.setAttributeNS(null, key, attr[key]);
    }
  }

  return elem;
};

$.text = function(elem, text) {
  elem.textContent = text;
  return elem;
};

$.inner = function(elem, html) {
  elem.innerHTML = html;
  return elem;
};

$.into = function(elem, children) {
  elem.append(...children);
  return elem;
};

$.on = function(elem, ...rest) {
  elem.addEventListener(...rest);
  return elem;
};
