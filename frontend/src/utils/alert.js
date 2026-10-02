import Swal from 'sweetalert2';

const colors = { confirm: '#1e6bff', cancel: '#6b7194' };

// Popups use dark colors when the site is in dark mode
const themed = () =>
  document.documentElement.dataset.theme === 'dark'
    ? { background: '#141a45', color: '#e6e9ff' }
    : {};

// Small popup in the corner that disappears by itself
export const toast = (message, icon = 'success') =>
  Swal.fire({
    ...themed(),
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

// Big popup for errors
export const showError = (message) =>
  Swal.fire({ ...themed(), icon: 'error', title: 'Oops...', text: message, confirmButtonColor: colors.confirm });

// Big popup for success
export const showSuccess = (title, text = '') =>
  Swal.fire({ ...themed(), icon: 'success', title, text, confirmButtonColor: colors.confirm });

// "Are you sure?" popup. Returns true if the user clicked Yes.
export const confirmAction = async (title, text = '', yesText = 'Yes') => {
  const result = await Swal.fire({
    ...themed(),
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: yesText,
    confirmButtonColor: colors.confirm,
    cancelButtonColor: colors.cancel,
  });
  return result.isConfirmed;
};

// Popup with 5 options for choosing a rating. Returns the number (1-5) or null if cancelled.
export const askRating = async (storeName, currentRating) => {
  const result = await Swal.fire({
    ...themed(),
    title: currentRating ? 'Modify your rating' : 'Rate this store',
    text: storeName,
    input: 'radio',
    inputOptions: {
      1: '★☆☆☆☆  1 - Poor',
      2: '★★☆☆☆  2 - Fair',
      3: '★★★☆☆  3 - Good',
      4: '★★★★☆  4 - Very good',
      5: '★★★★★  5 - Excellent',
    },
    inputValue: currentRating ? String(currentRating) : '',
    inputValidator: (value) => (!value ? 'Please choose a rating' : undefined),
    showCancelButton: true,
    confirmButtonText: currentRating ? 'Update rating' : 'Submit rating',
    confirmButtonColor: colors.confirm,
    cancelButtonColor: colors.cancel,
  });
  return result.isConfirmed ? Number(result.value) : null;
};