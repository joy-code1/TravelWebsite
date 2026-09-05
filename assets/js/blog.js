/* ==========================================================================
   Travosca — single blog page
   Renders the article (chosen with ?post=…), the sidebar and the comment
   thread.  Comments are stored locally in the browser — there is no back end.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.TRAVOSCA || {};
  var U = window.TravoscaUI;
  var base = D.base || '../';

  function img(name) { return base + 'assets/img/' + name; }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var STORIES = {
    'travel-stories': {
      lead: 'Three years of cancelled plans taught us more about travel than a decade of smooth bookings ever did. Here is what we kept.',
      blocks: [
        { h: 'Slow borders', p: [
          'The first thing we changed was the pace. Ten days across four countries looks impressive on paper and feels like a luggage commercial in real life. Our itineraries now sit in one region, often in one valley, and they leave the afternoons alone.',
          'That sounds like a small thing until you have watched a group of eight people eat a two-hour lunch in a village square because nobody had to be anywhere else. That afternoon is the trip.'
        ]},
        { img: 'blog-terraces.jpg', caption: 'Rice Terraces, Tegallalang — worth the 5am alarm, every single time.' },
        { h: 'Plans that bend', p: [
          'Flexible dates stopped being a nice-to-have. Every trip we sell now has a free day built in, and every booking can be moved once without a fee. It costs us margin and it saves the holiday.',
          'We also stopped pretending the weather is a footnote. If the monsoon is coming, we say so on the trip page, not in the small print.'
        ]},
        { pull: 'A good trip is not a longer checklist. It is one place, seen properly, with people who live there.' },
        { h: 'The trips worth waiting for', p: [
          'The places that rewarded patience were the ones that needed a little effort to reach: the alp you walk to instead of driving to, the island with one boat a day, the market that only happens on a Tuesday.',
          'If you take one thing from this: book the place that is slightly inconvenient. That is usually the one you will still be talking about in five years.'
        ]}
      ]
    },
    'destinations-on-sale': {
      lead: 'Prices moved this year, and not in the direction most people expect. Nine places where your money now goes a lot further than it did last season.',
      blocks: [
        { h: 'Why prices moved', p: [
          'Capacity came back faster than demand on a handful of long-haul routes, and a few currencies shifted hard against the dollar. Put those together and some classic routes are now cheaper than they were in 2019.',
          'The trick is knowing which ones. Airfares to South East Asia softened; overland Europe did not.'
        ]},
        { h: 'How to time it', p: [
          'For Asia, book eight to ten weeks out and travel in the shoulder weeks either side of the monsoon. For Europe, the opposite: book early, travel late. September beats August on price and on temperature.',
          'Either way, hold off on the extras. Cooking classes, day boats and guided hikes are almost always cheaper booked locally, and the money stays where you spent it.'
        ]}
      ]
    },
    'how-we-travel': {
      lead: 'Smaller groups, longer stays, and trains instead of short hops. A look at what actually changed in the way people move — and what was just noise.',
      blocks: [
        { h: 'Smaller groups', p: [
          'Our average group size dropped from fourteen to eight, and nobody asked for it to go back up. Smaller groups mean better rooms, quieter restaurants and guides who can actually hear your question.',
          'They also mean less waiting. The single biggest complaint in our old feedback forms was standing around while someone found their passport.'
        ]},
        { h: 'Trains over short hops', p: [
          'For anything under four hours, we now default to rail. It is slower on paper and faster in practice: no security, no transfers, no 90-minute buffer nobody enjoys.',
          'Where we do fly, we fly direct, even when it costs more. A connection is where luggage goes to die.'
        ]}
      ]
    }
  };

  var SEED_COMMENTS = [
    {
      name: 'Sara Jay',
      date: '18 January 2026',
      avatar: 'person-sara.jpg',
      text: '“One place, seen properly” is going straight into my next trip plan. We did four cities in nine days last year and I still have not recovered.'
    },
    {
      name: 'Cristian Daniel',
      date: '20 January 2026',
      avatar: 'person-cristian.jpg',
      text: 'The bit about booking the inconvenient place is so true. Our best day in Lombok was the one where the boat only ran once.'
    }
  ];

  /* --------------------------------------------------------------- article */
  function currentPost() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('post');
    var posts = D.posts || [];
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === id) return posts[i];
    }
    return posts[0];
  }

  function renderArticle(post) {
    var titleEl = document.querySelector('[data-post-title]');
    var metaEl = document.querySelector('[data-post-meta]');
    var body = document.querySelector('[data-blog-body]');
    if (!post || !body) return;

    document.title = post.title + ' — Travosca';
    if (titleEl) titleEl.textContent = post.title;
    if (metaEl) {
      metaEl.innerHTML =
        '<p>' + U.icon('users', 'icon--sm') + esc(post.author) + '</p>' +
        '<p>' + U.icon('calendar', 'icon--sm') + esc(post.date) + '</p>' +
        '<p>' + U.icon('folder', 'icon--sm') + esc(post.category) + '</p>';
    }

    var story = STORIES[post.id] || { lead: post.excerpt, blocks: [] };
    var html = '<img class="blog__cover" src="' + img(post.photo) + '" alt="' + esc(post.title) + '" width="1200" height="780">';
    html += '<p class="blog__lead">' + esc(story.lead) + '</p>';

    (story.blocks || []).forEach(function (block) {
      if (block.h) html += '<h2>' + esc(block.h) + '</h2>';
      (block.p || []).forEach(function (para) {
        html += '<p>' + esc(para) + '</p>';
      });
      if (block.img) {
        html += '<figure><img src="' + img(block.img) + '" alt="' + esc(block.caption || post.title) + '" loading="lazy" decoding="async">' +
          '<figcaption>' + esc(block.caption || '') + '</figcaption></figure>';
      }
      if (block.pull) html += '<blockquote class="blog__pull">' + esc(block.pull) + '</blockquote>';
    });

    html +=
      '<div class="blog__tags">' +
        '<span class="blog__tags-label">Tags:</span>' +
        '<span>Destination, Travel</span>' +
        '<div class="blog__share">' +
          '<button type="button" data-copy-link aria-label="Copy link to this article">' + U.icon('link') + '</button>' +
          '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(post.title) + '" target="_blank" rel="noopener" aria-label="Share on Twitter">' + U.icon('twitter', 'icon--solid') + '</a>' +
          '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href) + '" target="_blank" rel="noopener" aria-label="Share on Facebook">' + U.icon('facebook', 'icon--solid') + '</a>' +
        '</div>' +
      '</div>';

    body.innerHTML = html;

    var copy = body.querySelector('[data-copy-link]');
    if (copy) {
      copy.addEventListener('click', function () {
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            U.toast('Link copied to your clipboard.');
          }, function () {
            U.toast('Could not copy the link.', 'error');
          });
        } else {
          window.prompt('Copy this link:', url);
        }
      });
    }
  }

  /* ----------------------------------------------------------- recent posts */
  function renderRecent(current) {
    var wrap = document.querySelector('[data-recent-posts]');
    if (!wrap || !D.posts) return;
    wrap.innerHTML = (D.posts || []).map(function (p) {
      var url = base + 'single_blog-page/index.html?post=' + encodeURIComponent(p.id);
      var isCurrent = current && p.id === current.id;
      return '<a class="widget__post" href="' + url + '"' + (isCurrent ? ' aria-current="page"' : '') + '>' +
        '<img src="' + img(p.photoSm || p.photo) + '" alt="" loading="lazy">' +
        '<span><span class="widget__post-title">' + esc(p.title) + '</span>' +
        '<span class="widget__post-date">' + esc(p.date) + '</span></span></a>';
    }).join('');
  }

  /* --------------------------------------------------------------- comments */
  function storageKey(postId) { return 'travosca:comments:' + postId; }

  function loadComments(postId) {
    try {
      var raw = window.localStorage.getItem(storageKey(postId));
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveComments(postId, list) {
    try {
      window.localStorage.setItem(storageKey(postId), JSON.stringify(list));
    } catch (err) { /* storage disabled — comments just will not persist */ }
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join('');
  }

  function renderComments(post) {
    var list = document.querySelector('[data-comment-list]');
    var count = document.querySelector('[data-comment-count]');
    if (!list) return;

    var comments = SEED_COMMENTS.concat(loadComments(post.id));
    list.innerHTML = comments.map(function (c) {
      var avatar = c.avatar
        ? '<img src="' + img(c.avatar) + '" alt="" loading="lazy">'
        : esc(initials(c.name));
      return '<li class="comment' + (c.isNew ? ' is-new' : '') + '">' +
        '<span class="comment__avatar">' + avatar + '</span>' +
        '<div><div class="comment__head"><span class="comment__name">' + esc(c.name) + '</span>' +
        '<span class="comment__date">' + esc(c.date) + '</span></div>' +
        '<p class="comment__text">' + esc(c.text) + '</p></div></li>';
    }).join('');

    if (count) count.textContent = String(comments.length);
  }

  function initCommentForm(post) {
    var form = document.querySelector('[data-comment-form]');
    if (!form) return;
    var comment = form.querySelector('#cm-comment');
    var name = form.querySelector('#cm-name');
    var email = form.querySelector('#cm-email');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (comment.value.trim().length < 10) {
        U.setFieldError(comment, 'Please write at least a sentence.');
        comment.focus();
        return;
      }
      U.setFieldError(comment, '');

      if (!name.value.trim()) {
        U.setFieldError(name, 'Please add your name.');
        name.focus();
        return;
      }
      U.setFieldError(name, '');

      if (!U.validateEmail(email.value)) {
        U.setFieldError(email, 'A valid email is required (it is never published).');
        email.focus();
        return;
      }
      U.setFieldError(email, '');

      var stored = loadComments(post.id);
      stored.push({
        name: name.value.trim(),
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        text: comment.value.trim(),
        isNew: true
      });
      saveComments(post.id, stored);

      form.reset();
      renderComments(post);
      U.toast('Comment posted. Thanks for joining in!');
    });
  }

  var post = currentPost();
  renderArticle(post);
  renderRecent(post);
  renderComments(post);
  initCommentForm(post);
})();
