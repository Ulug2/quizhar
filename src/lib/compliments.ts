import { useStore } from "./store";

const BASE = [
  "Умница!",
  "Вот это память!",
  "Ты справляешься блестяще",
  "Так держать, красотка",
  "Идеально",
  "Ещё один в копилку знаний",
  "Ты сегодня в ударе",
  "Мозг на максимум",
  "Безупречно",
  "Врач от бога растёт",
  "Как же ты хорошо готова",
  "Экзамен уже боится",
  "Красиво ответила",
  "Ни капли сомнений",
  "Ты — моя гордость",
  "Чётко и уверенно",
  "Ещё чуть-чуть, и всё выучено",
  "Просто вау",
  "Отличный ответ",
  "Эта тема — твоя",
];

const WITH_NAME = [
  "{name}, ты умничка!",
  "{name}, это было идеально",
  "{name}, ты лучшая",
  "Браво, {name}!",
  "{name}, горжусь тобой",
  "{name}, ты сияешь",
];

const STREAK: Record<number, string> = {
  3: "Три подряд! Разогрелась",
  5: "Пять подряд, {name}! Огонь",
  10: "Десять подряд! Ты непобедима",
  15: "Пятнадцать подряд. Это уже талант",
  20: "Двадцать подряд! Профессор, это вы?",
  30: "Тридцать подряд. Я в восторге",
  50: "Пятьдесят подряд!!! Легенда",
};

let bag: string[] = [];

/** Picks a compliment without repeats until the whole list has been used. */
export function nextCompliment(streak: number): string {
  const { name, customCompliments } = useStore.getState().settings;
  const fill = (s: string) => s.replace(/\{name\}/g, name || "Ажар");
  if (STREAK[streak]) return fill(STREAK[streak]);
  if (!bag.length) {
    bag = [...BASE, ...WITH_NAME, ...customCompliments.filter(Boolean)];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return fill(bag.pop()!);
}
