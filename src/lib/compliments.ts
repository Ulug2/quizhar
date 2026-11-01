/** Her name. The app is made for one person. */
export const NAME = "Ажар";

const COMPLIMENTS = [
  "Умница моя",
  "Жаным, сол правильно",
  "Молодец, жаным",
  "Красотка моя",
  "Моя умничка",
  "Солнышко, всё верно",
  "Керемет, жаным!",
  "Бәрекелді, Ажар!",
  "Ақылдым менің",
  "Күнім, правильно!",
  "Вот это моя девочка",
  "Гордость моя",
  "Зайка, в точку",
  "Красавица и умница",
  "Ты лучшая, жаным",
  "Моя будущая врач",
  "Ажар, ты космос",
  "Котёнок, всё верно",
  "Умница, так держать",
  "Жаным, я в тебя верю",
  "Ты моё сокровище",
  "Самая умная у меня",
];

const STREAK: Record<number, string> = {
  3: "Три подряд, умница моя",
  5: "Пять подряд! Жаным, ты огонь",
  10: "Десять подряд! Красотка моя непобедима",
  15: "Пятнадцать подряд, Ажар! Бәрекелді!",
  20: "Двадцать подряд! Профессор Ажар",
  30: "Тридцать подряд. Жаным, я в восторге",
  50: "Пятьдесят подряд!!! Моя легенда",
};

let bag: string[] = [];

/** Picks a compliment without repeats until the whole list has been used. */
export function nextCompliment(streak: number): string {
  if (STREAK[streak]) return STREAK[streak];
  if (!bag.length) {
    bag = [...COMPLIMENTS];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop()!;
}

/** A cute greeting for the time of day. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Почему не спишь, жаным?";
  if (h < 12) return "Доброе утро, солнышко";
  if (h < 18) return "Привет, моя умница";
  return "Добрый вечер, красотка";
}

const LINES = [
  "Сегодня ты станешь ещё умнее.",
  "Немножко учёбы, и экзамен твой.",
  "Я в тебя верю, жаным.",
  "Каждая карточка приближает к пятёрке.",
  "Ты справишься, как всегда.",
  "Учимся вместе, по чуть-чуть.",
  "Моя будущая врач, вперёд!",
];

/** One encouraging line per day, so it stays the same until tomorrow. */
export function lineOfTheDay(date = new Date()): string {
  const day = Math.floor(date.getTime() / 864e5);
  return LINES[day % LINES.length];
}
