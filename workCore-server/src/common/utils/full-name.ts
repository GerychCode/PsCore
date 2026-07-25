/** Повне ім'я користувача. Прибирає повтор `${firstName} ${lastName}`. */
export const fullName = (u: {
  firstName: string;
  lastName: string;
}): string => `${u.firstName} ${u.lastName}`;
