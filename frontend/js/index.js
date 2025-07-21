// index.js – hero‑page interactions

document.addEventListener('DOMContentLoaded', () => {
    /* ---------- DOM refs ---------- */
    const searchInput  = document.getElementById('heroSearch');
    const searchBtn    = document.getElementById('heroSearchButton');
    const ctaSearchBtn = document.getElementById('ctaSearchBtn');
  
    /* ---------- Listeners ---------- */
    searchBtn.addEventListener('click', performSearch);
    ctaSearchBtn?.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
  
    animateStats();
  });
  
  /* ---------- Core search ---------- */
  async function performSearch() {
    const term = document.getElementById('heroSearch').value.trim();
    const params = new URLSearchParams();
    if (term) params.append('term', term);
    params.append('limit', '1'); // minimal payload just to register the hit
  
    try {
      await fetch(`/api/search?${params.toString()}`); // fire‑and‑forget; logs for analytics / cache warmup
    } catch (err) {
      console.warn('Search API call failed:', err);
    }
  
    // Always continue to full search page so user sees complete results
    window.location.href = term ? `search?term=${encodeURIComponent(term)}` : 'search.html';
  }
  
  /* ---------- Search‑preview click ---------- */
  function goToSearch() { window.location.href = 'search.html'; }
  
  /* ---------- Animate counters ---------- */
  function animateStats() {
    const statEls = document.querySelectorAll('.stats-counter');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'scale(1)';
        }
      });
    });
  
    statEls.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.8)';
      el.style.transition = 'all 0.8s ease';
      observer.observe(el);
    });
  }