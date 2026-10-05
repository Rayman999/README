// Plain helpers shared by server and client components. Must stay free of
// "use client": functions exported from a client module can't be called on
// the server.

export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}
