/**
 * 47OS Quest & Dialogue Engine (v1.0)
 * Handles virtual filesystem, state tracking, directory traversal (VOID:\>),
 * dynamic session keys, reverse psychology, pity hints, and Silhouette dialogues.
 */

(function() {
  'use strict';

  // --- 1. FULL DIALOGUE DATABASE FROM QUEST_DIALOGUES.md ---
  const DIALOGUES = {
    spam: {
      single: [
        'А?',
        'Чего тебе?',
        'Чего тыкаешь? Я слушаю.',
        'Эй!',
        'М?',
        'Чё такое?'
      ],
      annoyed: [
        'Хватит!',
        '…',
        'Мне не приятно, знаешь ли...',
        'Скучно?!',
        'Прекращай!',
        'Хватит в меня тыкать!',
        'Я смотрю у тебя руки чешутся.'
      ],
      leave: [
        'Всё, мне надоело. Развлекайся сам.',
        'Надоел.',
        'Какой неугомонный!',
        'Во прилип!',
        'О личном пространстве слышал?',
        'Надоело...',
        'Я те дам!'
      ]
    },
    terminalOpen: {
      first: [
        'Консоль хоть раз видел?',
        'Смотрите что нашёл!',
        'Опа, а ты либо знал, либо интуиция хорошая.',
        'Ну, а дальше что?',
        'Это тебе не GUI, буковы придётся жмафть.'
      ],
      repeat: [
        'Опять терминал открыл? Ну смотри, только ничего не поломай тут.',
        'Снова ты? Ну давай, жмакай по клавишам.',
        'И чё на этот раз забыл?'
      ]
    },
    help: [
      'Справку вызвал? Запоминай, подсказок на экране нет — всё ручками печатать придётся.',
      'Ну хоть с чего-то начал...',
      'Мда, сам или GPT подсказал?',
      'На wiki почитай, а точно, ты дальше своей ИИшки не ходишь...',
      'Ради интереса или реально не знаешь?',
      'Вот оно как, ну-ну, понял хоть?'
    ],
    dir: [
      'И что там?',
      'Вот оно что...',
      'Нука, что там?',
      'Чё хочешь найти?',
      'Секретов там нет, можешь не искать...',
      'Чего ищешь?',
      'Интересно стало?'
    ],
    unknownCmd: [
      'Ты что там накорябал? Нет такой команды. Внимательнее по кнопкам дави.',
      'Чего? "Ги... бл@?ь, что на$#й? Гелдиливилл, бл&%ь"',
      'Иди тренеруйся...',
      'Клавиатуру впервые видишь?',
      'Поторопился, аль чего?',
      'Сам придумал?',
      'А ещё что придумешь?',
      'Эт чё ты хотел ща?',
      'Пробовал читать, что пишешь?',
      'А подумать?',
      'Не друг, это тебе не это, оно не то эт самое.',
      'Во даёшь!',
      'Во даёт!',
      'Мда-а, а может тебе не сюда вообще?'
    ],
    whoami: [
      'Кто ты? Гость обычный. Прав админа тебе тут никто не давал.',
      'Конь в пальто!',
      'Себя спроси...',
      'Гуляй, ктож тебе права даст?!',
      'Удивлён? Я вот нет.',
      'Ахахах, посмотрите, какая жалость...',
      'Ухты, вот это да'
    ],
    neco: [
      'Она на месте. 18% прозрачности за окнами. Наблюдает.',
      'Она спит в фоне. Лучше не шуми здесь громко.',
      'Иногда кажется, что этот сайт принадлежит ей, а не автору.'
    ],
    secretLockTry: [
      'Тебе написали: НЕ ОТКРЫВАТЬ. Чего ты туда лезешь? Иди лучше арты в галерее посмотри.',
      'Фу, кышь-кышь! Там ничего, пусто!',
      'А туда, эээ, в общем там не интересно.',
      'Не, не открыть... Всё, вертайся в зад и займись делом.',
      'Секрет на то и секрет, чтобы быть секретом!',
      'Неа!',
      'Не стоит!'
    ],
    voidBreach: [
      'Ты как сюда вообще провалился?.. Сюда доступа быть не должно. А ну вылезай обратно!',
      'Это ты куда? Эт как вообще? Ну даёшь...',
      'Кто же знал, кто же знал...',
      'Эм, ну возможно это не так должно работать, определённо да...',
      'Как же это могло так случится? … как же...'
    ],
    voidRepeat: [
      'Опять сюда провалился? Тут ничего нового не выросло. Пустота она и есть пустота.',
      'Тебе там мёдом намазано в битых секторах? Вылезай обратно в C:\\.',
      'Ностальгия по синему экрану замучила?'
    ],
    keyAccepted: [
      'Ладно, ключ нашёл, молодец. Но это был просто замок на двери. Дальше на шару не проскочишь.',
      'А дальше что? Всё не так просто!',
      'Думаешь всё? А я думаю нет.',
      'Одну строчку перепечатал, герой. А голову включить готов?'
    ],
    riddleFailLight: [
      'Не угадал. Думал, всё так просто?',
      'Мимо!',
      'Хах!',
      'Серьёзно?!',
      'Ну да, "1234" и "admin" попробуй ещё.',
      'Неа, тут ничего, пошли отсюда...',
      'Ну видишь, никак...'
    ],
    riddleFailMedium: [
      'Слушай, ты уже третий раз наугад тычешь. Метод тыка тут не работает. Подумай головой.',
      'Думаешь сработает? А может подумать?',
      'Как думаешь, если бы всё было так просто, это было бы интересно?',
      'Мне кажется тут другой подход нужен...',
      'Слабоумие и отвага!',
      'Клавиатуру пожалей, она не виновата, что ты наугад строчишь.'
    ],
    riddlePity: [
      'Ладно, вижу, что ты упорный и не сдаёшься... Сделаю вид, что мне тебя жалко. Возможно где-то есть ответ, возможно ты его находил. Я точно не знаю, я лишь текст...',
      'Слушай, упорства тебе не занимать, но я думаю тебе стоит поискать ответ. Понимаешь? Это значит, что он где-то есть, если что...',
      'Это выглядит жалко, но так у тебя ничего не выйдет, поищи ответ в файлах, но я тебе об этом не говорил...',
      'Я вовсе не пытаюсь помочь, это не подсказка. Точно! … поищи ответ в файлах. Кто же это сказал?! Не понимаю... Хотя с разумом хомячка ты далеко не уйдёшь...'
    ],
    gateWarning: 'Подожди секунду, прежде чем читать. Ты прошёл этот путь сам. Сделай одолжение — не сливай ответы и решения, не говори никому, не спойлери другим. Дай остальным гостям возможность самим поломать голову и испытать этот азарт. Договорились?',
    winSolo: [
      'Ого... Сам докопался. Без единой подсказки. Честно говоря, не думал, что у кого-то хватит терпения дойти до конца. Заслужил, читай.',
      'Ни единой подсказки не взял... Ты либо маньяк, либо авторский код насквозь видишь. Снимаю шляпу, заслужил.',
      'Без нытья и тыканья наугад. Редкий гость нынче. Открываю.'
    ],
    winPity: [
      'Ну, дожал всё-таки! Хоть и с моей подсказкой, но дошёл. Всё это было сделано специально, чтобы проверить, забьёшь ты на полпути или нет. Молодец, упорства тебе не занимать. Ладно, держи секрет.',
      'Дополз! С кряхтением, с намёками, но дополз. Другой бы бросил на второй минуте, а ты досидел. Ладно, уважение за упрямство. Читай.',
      'Не без моей помощи, конечно, но результат есть результат. Держи, ты его выстрадал.'
    ],
    secretCloseOutro: [
      'Не совсем то, что ты ожидал увидеть, да? Никаких читов и золотых гор. Но я бы на твоём месте задумался... ведь главное сокровище — оно вообще-то внутри нас.',
      'Думал, тут кнопка «взломать пентагон» спрятана? Разочарован? А ты вчитайся ещё раз на досуге... Главное ты уже нашёл.',
      'Вот и всё. Никакой магии, просто слова. Но правильные слова в правильный момент стоят дороже любого кода.'
    ],
    postQuest: {
      whoami: [
        'Теперь ты точно знаешь, кто ты. В этой системе ты теперь свой.',
        'Гость, который докопался до сути. Уважаю.'
      ],
      dir: [
        'Всё знакомо? Теперь эта система для тебя не чужая. Рад был пообщаться.',
        'Все секреты раскрыты, все файлы прочитаны. Просто ламповый уголок на память.'
      ],
      neco: [
        'Она всё так же здесь, в фоне. Полупрозрачная, едва заметная. И ты здесь. Уютно получилось, скажи?',
        'Она видела, как ты дошёл до конца. Передаёт неслышное "ня".'
      ],
      afk: 'Тихо тут... Раньше я один сидел, а теперь вроде как с тобой. И это даже не раздражает.'
    },
    archetypes: {
      flawless: [
        'Либо ты гений, либо нейросеть за тебя команды строчила... Слишком гладко идёшь.',
        'Эй, помедленнее. Ты исходники на GitHub подглядывал, признавайся?',
        'С первой попытки? Подозрительно... Но ладно, спишем на хорошую интуицию.',
        'Хм. Ни одной лишней команды. Ты точно человек, а не скрипт?'
      ],
      archivist: [
        'Ты реально каждый текстовик открыл? У меня столько времени нет, а ты нашёл...',
        'Да ты маньяк, всю файловую систему перерыл. Ладно, уважение за дотошность.',
        'Ни одного каталога не пропустил. Любишь всё по полочкам раскладывать, да?',
        'Вот это я понимаю — исследователь. Не то что те, кто сразу кликает куда попало.'
      ],
      slowpoke: [
        'Ты тут уже десятый круг по папкам наматываешь... Не надоело?',
        'Там новых файлов не появилось, если что. Всё то же самое лежит.',
        'Может, чайку попьёшь? А то смотрю, процессор у тебя уже дымится.',
        'Ты ищешь чёрную кошку в темной комнате, которой там нет. Сделай паузу, выдохни.'
      ]
    }
  };

  // --- 2. VIRTUAL FILESYSTEM (VFS) ---
  const VFS = {
    'C:': {
      'manifesto.txt': `Этот сайт задуман не как временный приют, а как постоянный след в бесконечном пространстве сети. Слишком много ценных мыслей и плодов творчества бесследно исчезают в цифровом шуме, оседая мёртвым грузом на жёстких дисках.\n\nМир вокруг становится всё агрессивнее, интернет заковывают в блокировки и бесконечные ограничения, а на горизонте маячит холодный разум AGI — и становится всё непонятнее, куда всё катится и что ждёт нас впереди. Люди черствеют, теряется былая доброта и открытость. Раньше интернет был местом уюта, дружбы и открытий, а сейчас превратился в коммерческую витрину и арену для токсичных споров.\n\nДля меня это пространство — не попытка спорить с глобальными трендами, а способ зафиксировать своё присутствие и сохранить свои безумные задумки. Это мой личный архив, моя роспись, оставленная на память. Заходя сюда, ты прикасаешься к живому авторскому взгляду и можешь взглянуть на мир без лишней суеты.`,
      'art': {
        'drawing_diary.txt': `Здесь собраны мои работы — от рисунков от руки до цифровых образов, доработанных нейросетями. Каждая из них — часть моего авторского видения, где идея важнее инструментов, а результат — отражение личного восприятия и творческих экспериментов.`,
        'palette_1998.cfg': `#008080 (Teal Desktop)\n#C0C0C0 (Classic Gray)\n#000080 (Navy Titlebar)\n#00FF66 (Active Status)`
      },
      'drafts': {
        'rejected_ideas.txt': `Отклонено: летающие неоновые блёстки, всплывающие окна с подпиской, гладкий плоский дизайн из 2024.`,
        'todo_eternal.txt': `[x] Настроить WebRTC на порту 443\n[x] Починить макросы Игрока 2\n[ ] Выспаться когда-нибудь\n[ ] Нарисовать ещё пять котов`,
        'secrets_do_not_open.txt': '__LOCKED__'
      },
      'games': {
        'mbtl_moves.txt': `[ИГРОК 2 ШПАРГАЛКА]\nA (7 / U) - Быстрый удар\nB (8 / I) - Средний\nC (9 / O) - Тяжёлый\nD (4 / J) - Щит\n0 / C - Дэш (A+B)\n5 / X - Shield Bunker (A+D)\n6 / H - Heat Mode (A+B+C)`,
        'frame_data_notes.txt': `Задержка ввода должна быть строже 3 кадров (менее 50 мс). Любой лаг в нейтрале карается комбо на 4000 урона.`
      },
      'neco': {
        'shadow_entity.log': `Она появилась в кодовой базе случайно. Просто тень за рабочим столом. 18% прозрачности. Без искусственных глаз. Не трогайте её — она держит стабильность системы.`,
        'ascii_art.txt': ` /\\_/\\\n( o.o )\n > ^ <   [NECO-ARC SHADOW ENTITY]`
      }
    },
    'VOID:': {
      'crash_dump.log': '__DYNAMIC_CRASH_DUMP__'
    }
  };

  const FINAL_DEDICATION_TEXT = `«Спасибо, что потратил своё время на это исследование. В мире, где всё поверхностно и люди привыкли прокликивать всё за секунду, твоё упорство — редкая ценность.\n\nПройдя этот путь, ты доказал, что любопытство способно преодолеть любые преграды. Пусть этот опыт станет напоминанием: за привычной оболочкой всегда скрывается авторский замысел, а в каждом действии есть свой смысл. Не бойся исследовать мир с тем же упорством, ведь самое ценное — это способность видеть живое среди цифрового шума».`;

  // --- 3. QUEST ENGINE STATE ---
  class QuestEngine {
    constructor() {
      this.reset();
    }

    reset() {
      this.currentDrive = 'C:';
      this.currentDir = []; // empty array means root of current drive
      this.terminalOpenCount = 0;
      this.voidVisited = false;
      this.dynamicKey = this.generateKey();
      this.questStage = 'LOCKED'; // 'LOCKED', 'KEY_ACCEPTED', 'GATE_WAITING', 'COMPLETED'
      this.riddleFailCount = 0;
      this.filesRead = new Set();
      this.commandCount = 0;
      this.mistakeCount = 0;
      this.pityUsed = false;
      this.afkTriggered = false;
      this.isSecretOpen = false;
    }

    generateKey() {
      const hexChars = '0123456789ABCDEF';
      let tail = '';
      for (let i = 0; i < 4; i++) {
        tail += hexChars[Math.floor(Math.random() * hexChars.length)];
      }
      return `47R-${tail}`;
    }

    getRandom(arr) {
      if (!arr || arr.length === 0) return '';
      return arr[Math.floor(Math.random() * arr.length)];
    }

    getCurrentPrompt() {
      if (this.currentDrive === 'VOID:') {
        return 'VOID:\\>';
      }
      if (this.currentDir.length === 0) {
        return 'C:\\>';
      }
      return `C:\\${this.currentDir.join('\\').toUpperCase()}>`;
    }

    getFolderObj() {
      let root = VFS[this.currentDrive];
      for (const d of this.currentDir) {
        if (root && typeof root[d] === 'object') {
          root = root[d];
        } else {
          return null;
        }
      }
      return root;
    }

    // Generate crash_dump.log with session dynamic key and byte noise
    getCrashDumpContent() {
      return `[KERNEL_DUMP_LOG_V98.2]
0x0000: 48 45 4C 4C 4F 20 49 53 20 41 4E 20 4F 55 54 44 41 54 45 44
0x0010: 20 43 4F 4E 43 45 50 54 00 00 00 00 00 00 00 00 00 00 00 00
0x0020: 53 59 53 5F 43 4F 52 45 5F 45 52 52 4F 52 00 44 45 42 55 47
0x0030: 20 44 41 54 41 3A 20 00 00 00 00 00 00 00 00 00 00 00 00 00
0x0040: 7B 44 49 4E 41 4D 49 43 5F 4B 45 59 3D ${this.dynamicKey} 7D 20 49 4E
0x0050: 54 45 47 52 49 54 59 00 00 00 00 00 00 00 00 00 00 00 00 00
0x0060: 46 41 54 41 4C 20 45 58 43 45 50 54 49 4F 4E 00 00 00 00 00
[MEMORY_DUMP_END]`;
    }

    onTerminalOpen() {
      this.terminalOpenCount++;
      if (window.Silhouette) {
        if (this.questStage === 'COMPLETED') {
          window.Silhouette.say('Снова в консоли? Чувствуй себя как дома.');
        } else if (this.terminalOpenCount === 1) {
          window.Silhouette.say(this.getRandom(DIALOGUES.terminalOpen.first));
        } else {
          window.Silhouette.say(this.getRandom(DIALOGUES.terminalOpen.repeat));
        }
      }
    }

    onTerminalClose() {
      if (this.isSecretOpen) {
        this.isSecretOpen = false;
        if (window.Silhouette) {
          window.Silhouette.say(this.getRandom(DIALOGUES.secretCloseOutro));
        }
      }
    }

    // Handles the command line input
    execute(inputStr) {
      this.commandCount++;
      const raw = inputStr.trim();
      if (!raw) return { text: '', isError: false };

      // Handle GATE_WAITING (Enter confirmation for gate)
      if (this.questStage === 'GATE_WAITING') {
        this.questStage = 'COMPLETED';
        this.isSecretOpen = true;
        const winPhrase = this.pityUsed ? this.getRandom(DIALOGUES.winPity) : this.getRandom(DIALOGUES.winSolo);
        if (window.Silhouette) {
          window.Silhouette.say(winPhrase);
        }
        return {
          text: `\n================== [ ДОСТУП РАЗРЕШЁН ] ==================\n\n${FINAL_DEDICATION_TEXT}\n\n==========================================================\n`,
          isError: false
        };
      }

      // Handle Riddle input if we are in KEY_ACCEPTED stage
      if (this.questStage === 'KEY_ACCEPTED') {
        const clean = raw.toLowerCase().replace(/['"«»]/g, '').trim();
        const validAnswers = ['след', 'память', 'на память', 'оставить след', 'свой след', 'присутствие'];
        
        if (validAnswers.includes(clean)) {
          this.questStage = 'GATE_WAITING';
          if (window.Silhouette) {
            window.Silhouette.say(DIALOGUES.gateWarning);
          }
          return {
            text: `\n╔═════════════════════════════════════════════════════════════════════════╗\n║ [ВАЖНО]                                                                 ║\n║ Подожди секунду, прежде чем читать. Ты прошёл этот путь сам.           ║\n║ Сделай одолжение — не сливай ответы и решения, не говори никому,        ║\n║ не спойлери другим. Дай остальным гостям возможность самим             ║\n║ поломать голову и испытать этот азарт. Договорились?                   ║\n╚═════════════════════════════════════════════════════════════════════════╝\n\n[ Нажмите Enter, чтобы подтвердить и открыть файл ]\n`,
            isError: false
          };
        } else {
          this.riddleFailCount++;
          this.mistakeCount++;
          if (this.riddleFailCount >= 5) {
            this.pityUsed = true;
            if (window.Silhouette) window.Silhouette.say(this.getRandom(DIALOGUES.riddlePity));
          } else if (this.riddleFailCount >= 3) {
            if (window.Silhouette) window.Silhouette.say(this.getRandom(DIALOGUES.riddleFailMedium));
          } else {
            if (window.Silhouette) window.Silhouette.say(this.getRandom(DIALOGUES.riddleFailLight));
          }
          return {
            text: `[ОТВЕТ НЕВЕРЕН]\nВОПРОС: Ради чего?\n> `,
            isError: true
          };
        }
      }

      // Normal DOS commands
      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      // 1. HELP
      if (cmd === 'help') {
        if (window.Silhouette) {
          window.Silhouette.say(this.getRandom(DIALOGUES.help));
        }
        return {
          text: `Команды 47OS Virtual DOS:
  DIR                - Вывод содержимого текущего каталога
  CD <папка>         - Смена каталога (CD .. для перехода выше)
  CAT <файл>         - Просмотр содержимого текстового файла
  UNLOCK <ключ>      - Ввод дешифрующего токена для закрытых файлов
  WHOAMI             - Сведения о текущей учетной записи
  NECO               - Диагностика фоновой сущности 47OS
  CLS / CLEAR        - Очистка экрана консоли
  EXIT               - Закрытие сеанса терминала`,
          isError: false
        };
      }

      // 2. CLS / CLEAR
      if (cmd === 'cls' || cmd === 'clear') {
        return { text: '__CLEAR__', isError: false };
      }

      // 3. EXIT
      if (cmd === 'exit') {
        if (window.winManager) window.winManager.closeWindow('win-terminal');
        return { text: '', isError: false };
      }

      // 4. WHOAMI
      if (cmd === 'whoami') {
        if (window.Silhouette) {
          if (this.questStage === 'COMPLETED') {
            window.Silhouette.say(this.getRandom(DIALOGUES.postQuest.whoami));
          } else {
            window.Silhouette.say(this.getRandom(DIALOGUES.whoami));
          }
        }
        return {
          text: `Пользователь: Гость #47\nПривилегии: Пользовательские (Read-Only)\nСреда: 47OS 98 Second Edition Core`,
          isError: false
        };
      }

      // 5. NECO
      if (cmd === 'neco') {
        if (window.Silhouette) {
          if (this.questStage === 'COMPLETED') {
            window.Silhouette.say(this.getRandom(DIALOGUES.postQuest.neco));
          } else {
            window.Silhouette.say(this.getRandom(DIALOGUES.neco));
          }
        }
        return {
          text: `[ENTITY_STATUS: NECO-ARC]
Status: ACTIVE
Opacity: 18%
State: IDLE / OBSERVING
Observations: Persistent background presence detected.
[Note]: She seems to be watching... don't bother her.`,
          isError: false
        };
      }

      // 6. DIR / LS
      if (cmd === 'dir' || cmd === 'ls') {
        if (window.Silhouette) {
          if (this.questStage === 'COMPLETED') {
            window.Silhouette.say(this.getRandom(DIALOGUES.postQuest.dir));
          } else if (this.filesRead.size >= 6) {
            window.Silhouette.say(this.getRandom(DIALOGUES.archetypes.archivist));
          } else {
            window.Silhouette.say(this.getRandom(DIALOGUES.dir));
          }
        }

        const folder = this.getFolderObj();
        if (!folder) return { text: 'Ошибка чтения каталога.', isError: true };

        let output = ` Содержимое папки ${this.getCurrentPrompt().slice(0, -1)}\n\n`;
        let countDirs = 0;
        let countFiles = 0;

        for (const [name, val] of Object.entries(folder)) {
          if (typeof val === 'object') {
            output += `  <DIR>          ${name.toUpperCase()}\n`;
            countDirs++;
          } else {
            const size = (typeof val === 'string' ? val.length : 128);
            output += `        ${size.toString().padStart(6, ' ')}   ${name}\n`;
            countFiles++;
          }
        }
        output += `\n       ${countFiles} файл(ов)\n       ${countDirs} папок`;
        return { text: output, isError: false };
      }

      // 7. CD
      if (cmd === 'cd') {
        if (!arg || arg === '.' || arg === '\\' || arg === '/') {
          if (this.currentDrive === 'VOID:') {
            this.currentDrive = 'C:';
            this.currentDir = [];
            this.updateVoidMode(false);
          } else {
            this.currentDir = [];
          }
          return { text: '', isError: false };
        }

        // CD .. (Check for directory traversal into VOID)
        if (arg === '..' || arg === '../..' || arg === '/..') {
          if (this.currentDrive === 'C:' && this.currentDir.length === 0) {
            // BREACH INTO VOID!
            this.currentDrive = 'VOID:';
            this.currentDir = [];
            this.updateVoidMode(true);
            if (window.Silhouette) {
              if (!this.voidVisited) {
                this.voidVisited = true;
                window.Silhouette.say(this.getRandom(DIALOGUES.voidBreach));
              } else {
                window.Silhouette.say(this.getRandom(DIALOGUES.voidRepeat));
              }
            }
            return {
              text: `[KERNEL PANIC: UNMAPPED SECTOR]\nФайловый дескриптор C:\\ обойдён.\nТекущий сектор: //VOID/\nЗафиксирован сбой адресации. Обнаружен дамп памяти.`,
              isError: true
            };
          } else if (this.currentDrive === 'VOID:') {
            // Exit from VOID back to C:
            this.currentDrive = 'C:';
            this.currentDir = [];
            this.updateVoidMode(false);
            return { text: '', isError: false };
          } else {
            this.currentDir.pop();
            return { text: '', isError: false };
          }
        }

        // Target directory navigation
        const target = arg.toLowerCase().replace(/\\/g, '/').split('/')[0];
        if (target === 'c:' || target === 'c:\\') {
          this.currentDrive = 'C:';
          this.currentDir = [];
          this.updateVoidMode(false);
          return { text: '', isError: false };
        }

        const folder = this.getFolderObj();
        if (folder && typeof folder[target] === 'object') {
          this.currentDir.push(target);
          return { text: '', isError: false };
        } else {
          this.mistakeCount++;
          return { text: `Каталог '${arg}' не найден.`, isError: true };
        }
      }

      // 8. UNLOCK
      if (cmd === 'unlock') {
        const keyArg = arg.toUpperCase().trim();
        if (keyArg === this.dynamicKey) {
          this.questStage = 'KEY_ACCEPTED';
          if (window.Silhouette) {
            window.Silhouette.say(this.getRandom(DIALOGUES.keyAccepted));
          }
          return {
            text: `[ДЕШИФРОВАНИЕ УСПЕШНО: ВНЕШНИЙ БАРЬЕР СНЯТ]\nКонтрольный блок активирован.\n\n[ПРОВЕРКА КОНТЕКСТА]\nВОПРОС: Ради чего?\n> `,
            isError: false
          };
        } else {
          this.mistakeCount++;
          return { text: `[ОШИБКА] Неверный токен дешифрования '${arg}'.`, isError: true };
        }
      }

      // 9. CAT / TYPE
      if (cmd === 'cat' || cmd === 'type') {
        if (!arg) return { text: 'Укажите имя файла.', isError: true };

        const target = arg.toLowerCase();
        const folder = this.getFolderObj();

        // Reading crash_dump.log in VOID:
        if (this.currentDrive === 'VOID:' && (target === 'crash_dump.log' || target === 'crash_dump')) {
          this.filesRead.add('crash_dump.log');
          return { text: this.getCrashDumpContent(), isError: false };
        }

        // Reading secrets_do_not_open.txt
        if (target.includes('secrets_do_not_open')) {
          if (this.questStage === 'COMPLETED') {
            this.isSecretOpen = true;
            return {
              text: `\n================== [ СЕКРЕТНЫЙ ФАЙЛ 47OS ] ==================\n\n${FINAL_DEDICATION_TEXT}\n\n============================================================\n`,
              isError: false
            };
          } else {
            if (window.Silhouette) {
              window.Silhouette.say(this.getRandom(DIALOGUES.secretLockTry));
            }
            return {
              text: `[ОШИБКА ДОСТУПА] Файл заблокирован протоколом 47R-LOCK.\nУровень допуска: GUEST.\nТребуется токен аварийной целостности ядра (UNLOCK <token>).`,
              isError: true
            };
          }
        }

        if (folder && folder[target]) {
          if (typeof folder[target] === 'object') {
            return { text: `Ошибка: '${target}' является каталогом, а не файлом.`, isError: true };
          }
          this.filesRead.add(target);
          const content = folder[target];

          // Silhouette reaction to manifesto
          if (target === 'manifesto.txt' && window.Silhouette) {
            if (this.questStage === 'COMPLETED') {
              window.Silhouette.say(DIALOGUES.postQuest.dir[1]);
            } else if (this.filesRead.size > 1) {
              window.Silhouette.say('Опять перечитываешь? Ищешь тайный смысл или просто зацепило?');
            } else {
              window.Silhouette.say('Это манифест. Настоящий, а не шаблонная отписка. Почитай, если не разучился длинные тексты воспринимать.');
            }
          }

          return { text: content, isError: false };
        }

        this.mistakeCount++;
        return { text: `Файл '${arg}' не найден.`, isError: true };
      }

      // Unrecognized command
      this.mistakeCount++;
      if (window.Silhouette) {
        window.Silhouette.say(this.getRandom(DIALOGUES.unknownCmd));
      }
      return {
        text: `Команда '${cmd}' не распознана. Введите 'help' для списка команд.`,
        isError: true
      };
    }

    updateVoidMode(isVoid) {
      const termWin = document.getElementById('win-terminal');
      if (termWin) {
        if (isVoid) {
          termWin.classList.add('void-mode');
          const title = termWin.querySelector('.title-bar-text');
          if (title) title.innerHTML = `<span>⚠</span> // UNMAPPED KERNEL MEMORY: VOID //`;
        } else {
          termWin.classList.remove('void-mode');
          const title = termWin.querySelector('.title-bar-text');
          if (title) title.innerHTML = `<span>💻</span> Сеанс MS-DOS [47OS Prompt]`;
        }
      }
    }
  }

  window.QuestEngine = new QuestEngine();
})();
