import { useEffect } from 'react';

const setMeta = (name, content) => {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

/**
 * Set <title> and the meta description for the current page.
 * The Layout calls this once per route from core/config/navigation.js, so pages
 * do not have to remember to.
 */
export function useDocumentTitle(title, description) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  useEffect(() => {
    if (description) setMeta('description', description);
  }, [description]);
}
