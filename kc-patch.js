(function () {
  var HERO = "images/hero-landscape.jpg?v=seated";
  var LOGO = "images/kc-logo.png";
  var FOOTART = "images/footer-art.svg";
  var FAQ = "images/kc-faq.jpg";
  var heroKey = "c837a6_a94a52885cd54599";
  var logoKey = "1764680381066";
  var faqKey = "c837a6_c6aa0b7850f24b18a3f11dda09bf1e1a";
  var timer = 0;

  var localLogo = new URL(LOGO, document.baseURI).href;
  var localHero = new URL(HERO, document.baseURI).href;
  var localFaq = new URL(FAQ, document.baseURI).href;
  var localArt = new URL(FOOTART, document.baseURI).href;

  function needsLogo(img, src) {
    if (img.src === localLogo) return false;
    if (src.indexOf(logoKey) !== -1) return true;
    if (src.indexOf("kc-logo.png") !== -1 || src.indexOf("kc-hearts") !== -1) return true;
    if ((img.getAttribute("alt") || "") === "Homepage" && src.indexOf("media/images%2F") !== -1) return true;
    return false;
  }

  function fixImages() {
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = (img.currentSrc || "") + " " + (img.getAttribute("src") || "") + " " + (img.getAttribute("srcset") || "");
      if (src.indexOf(heroKey) !== -1 && img.src !== localHero) {
        img.removeAttribute("srcset");
        img.src = localHero;
      } else if (src.indexOf(faqKey) !== -1 && img.src !== localFaq) {
        img.removeAttribute("srcset");
        img.src = localFaq;
      } else if (needsLogo(img, src)) {
        img.removeAttribute("srcset");
        img.src = localLogo;
      }
    }
    var styled = document.querySelectorAll("[style*='" + heroKey + "'], [style*='" + logoKey + "']");
    for (var j = 0; j < styled.length; j++) {
      var el = styled[j];
      var style = el.getAttribute("style") || "";
      if (style.indexOf(heroKey) !== -1) {
        el.setAttribute("style", style.replace(/url\(([^)]*)\)/g, 'url("' + HERO + '")'));
      } else if (style.indexOf(logoKey) !== -1) {
        el.setAttribute("style", style.replace(/url\(([^)]*)\)/g, 'url("' + LOGO + '")'));
      }
    }
  }

  function fixFooter() {
    var logo = document.querySelector("[id$='_comp-miormgeg'] img");
    if (logo && logo.src !== localArt) {
      logo.removeAttribute("srcset");
      logo.src = localArt;
    }
    var copy = document.querySelector("[id$='_comp-mirdon52']");
    if (copy && /Wix|Powered and secured/.test(copy.textContent)) {
      copy.textContent = "© 2026 by K&C";
    }
  }

  var storyPhotos = [];
  for (var n = 1; n <= 15; n++) {
    storyPhotos.push("images/story/" + (n < 10 ? "0" : "") + n + ".jpg");
  }
  var storyIndex = 0;
  var storyTimer = 0;

  function storySlideshow() {
    var box = document.querySelector("#comp-mins3asb4 ._bg-video-container_x7ip3_52");
    if (!box) return;
    var old = document.querySelectorAll(".kc-story-slides");
    for (var o = 0; o < old.length; o++) old[o].remove();
    var videos = box.querySelectorAll("video");
    for (var v = 0; v < videos.length; v++) {
      var sources = videos[v].querySelectorAll("source");
      for (var s = 0; s < sources.length; s++) sources[s].remove();
      if (videos[v].getAttribute("src")) videos[v].removeAttribute("src");
      videos[v].muted = true;
      videos[v].pause();
      videos[v].style.opacity = "0";
    }
    var button = box.querySelector(".background-video-play-pause-button");
    if (button && button.style.display !== "none") button.style.display = "none";
    var poster = box.querySelector("#videoPoster_bgVideo_comp-mins3asb4");
    if (poster && poster.style.opacity !== "0") poster.style.opacity = "0";
    if (!document.getElementById("kc-story-shape")) {
      var shape = document.createElement("style");
      shape.id = "kc-story-shape";
      shape.textContent =
        "#comp-mins3asb4 video{display:none !important;}" +
        "#videoPoster_bgVideo_comp-mins3asb4{display:none !important;}" +
        "#comp-mins3asb4 ._bg-video-container_x7ip3_52{overflow:hidden;}" +
        "#comp-mins5dhy{position:relative;z-index:1 !important;}" +
        "#comp-mins3as3{position:relative;z-index:2 !important;}" +
        "#comp-mir9f7ct{position:relative;z-index:3;}";
      document.head.appendChild(shape);
    }

    function makeSlide(className) {
      var img = document.createElement("img");
      img.className = className;
      img.alt = "";
      img.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;object-fit:var(--video-fit, cover);object-position:var(--video-position, center center);opacity:0;transition:opacity 900ms ease;pointer-events:none;";
      return img;
    }
    var front = box.querySelector("img.kc-story-a");
    var back = box.querySelector("img.kc-story-b");
    if (!front || !back) {
      var oldSlides = box.querySelectorAll("img.kc-story-src, img.kc-story-a, img.kc-story-b");
      for (var s = 0; s < oldSlides.length; s++) oldSlides[s].remove();
      front = makeSlide("kc-story-a");
      back = makeSlide("kc-story-b");
      front.style.opacity = "1";
      front.style.zIndex = "1";
      back.style.zIndex = "0";
      box.appendChild(front);
      box.appendChild(back);
      front.src = new URL(storyPhotos[storyIndex], document.baseURI).href;
      clearInterval(storyTimer);
      storyTimer = setInterval(function () {
        var live = document.querySelector("#comp-mins3asb4 ._bg-video-container_x7ip3_52");
        if (!live) return;
        var a = live.querySelector("img.kc-story-a");
        var b = live.querySelector("img.kc-story-b");
        if (!a || !b) return;
        var showingA = a.style.opacity === "1";
        var incoming = showingA ? b : a;
        var outgoing = showingA ? a : b;
        storyIndex = (storyIndex + 1) % storyPhotos.length;
        var src = new URL(storyPhotos[storyIndex], document.baseURI).href;
        function show() {
          incoming.style.zIndex = "2";
          outgoing.style.zIndex = "1";
          incoming.style.opacity = "1";
          outgoing.style.opacity = "0";
        }
        if (incoming.src === src && incoming.complete) show();
        else {
          incoming.addEventListener("load", show, { once: true });
          incoming.src = src;
        }
      }, 4000);
    }
  }

  var revealIO = 0;

  function showAll() {
    var rest = document.querySelectorAll(".kc-reveal:not(.kc-shown)");
    for (var r = 0; r < rest.length; r++) rest[r].className += " kc-shown";
  }

  function revealOnScroll() {
    if (document.documentElement.className.indexOf("kc-anim") === -1) return;
    if (!revealIO) {
      if (!("IntersectionObserver" in window)) { showAll(); return; }
      revealIO = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          entries[i].target.className += " kc-shown";
          revealIO.unobserve(entries[i].target);
        }
      }, { threshold: 0.05, rootMargin: "0px 0px -8% 0px" });
      // A page whose frames never advance (an off-screen preview pane) also never
      // fires the observer, which would leave the copy invisible forever. Only a
      // hidden document qualifies: a visible tab that is merely slow (throttled
      // CPU in DevTools device mode) would otherwise get every section marked
      // shown before the guest ever scrolls to it, so no animation is seen.
      var framed = false;
      requestAnimationFrame(function () { framed = true; });
      setTimeout(function () { if (!framed && document.hidden) showAll(); }, 900);
    }
    var els = document.querySelectorAll(".kc-reveal:not(.kc-shown)");
    for (var e = 0; e < els.length; e++) revealIO.observe(els[e]);
  }

  function heroHeight() {}

  function faqCrop() {
    if (document.getElementById("kc-faq-shape")) return;
    var shape = document.createElement("style");
    shape.id = "kc-faq-shape";
    shape.textContent = "#img-comp-mioegxen img{object-position:50% 6% !important;}";
    document.head.appendChild(shape);
  }

  function run() {
    // First: the reveal styles hide this copy until we mark it shown, so nothing
    // later in run() may throw and leave the page blank.
    revealOnScroll();
    fixImages();
    fixFooter();
    storySlideshow();
    faqCrop();
    heroHeight();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }

  function onMutate() {
    // Runs as a microtask, so a demo photo handed to us by Wix is replaced
    // before the next paint instead of flashing for a frame.
    fixImages();
    fixFooter();
    schedule();
  }

  [localHero, localLogo, localFaq].forEach(function (href) {
    var pre = new Image();
    pre.src = href;
  });

  run();
  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("load", run);
  new MutationObserver(onMutate).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "style"]
  });
})();
