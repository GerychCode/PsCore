import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma';
import { SYSTEM_TAGS } from '../work.shift.tag/system-tags';

export interface ShiftEvaluation {
  score: number;
  penalty: number;
  clean: boolean;
}

export interface EmployeeLevel {
  userId: number;
  level: number;
  baseLevel: number;
  xp: number;
  reliability: number;
  totalShifts: number;
  stats: {
    approved: number;
    pending: number;
    rejected: number;
    cleanShifts: number;
    penaltyPoints: number;
  };
}

interface EvaluableShift {
  status: string;
  totalHours?: number | null;
  tags?: { name?: string; severity: number }[];
}

/**
 * Теги, які НЕ є провиною працівника: вони описують обставини, а не поведінку.
 * «Поза графіком» здебільшого означає, що графік не заповнили; «У вихідний» —
 * що людина вийшла підмінити колегу. Штрафувати за це немає за що.
 */
const NEUTRAL_TAGS: readonly string[] = [
  SYSTEM_TAGS.OFF_SCHEDULE.name,
  SYSTEM_TAGS.DAY_OFF.name,
];

/** Теги, за які треба доплачувати балами, а не віднімати їх. */
const BONUS_TAGS: readonly string[] = [SYSTEM_TAGS.OVERTIME.name];

@Injectable()
export class EmployeeLevelService {
  private readonly MAX_LEVEL = 10;
  private readonly XP_PER_LEVEL = 100;
  // Досвід — головний драйвер: сам факт відпрацьованої зміни + кожна година
  private readonly WORKED_SCORE = 10;
  private readonly XP_PER_HOUR = 1;
  // Якість — вторинний модифікатор
  private readonly CLEAN_BONUS = 2;
  private readonly PENALTY_PER_SEVERITY = 2;

  constructor(private readonly prisma: PrismaService) {}

  evaluateShift(shift: EvaluableShift): ShiftEvaluation {
    // Відхилена зміна — не досвід: не нараховуємо і не штрафуємо
    if (shift.status === 'REJECTED') {
      return { score: 0, penalty: 0, clean: false };
    }

    let score = this.WORKED_SCORE;
    score += Math.floor(shift.totalHours ?? 0) * this.XP_PER_HOUR;

    const tags = shift.tags ?? [];

    // Раніше штрафувався БУДЬ-ЯКИЙ тег, включно з «Понаднормово»: зміна на
    // дві години довша давала на 2 бали МЕНШЕ за звичайну (−2 штраф і −2
    // втрачений бонус за чистоту). Тепер теги розділені за змістом.
    let penalty = 0;
    let bonus = 0;
    let hasPenaltyTag = false;

    for (const tag of tags) {
      const name = tag.name ?? '';
      if (NEUTRAL_TAGS.includes(name)) continue;

      if (BONUS_TAGS.includes(name)) {
        bonus += tag.severity * this.PENALTY_PER_SEVERITY;
        continue;
      }

      // Решта — і системні відхилення, і кастомні теги адміна: штраф
      penalty += tag.severity * this.PENALTY_PER_SEVERITY;
      hasPenaltyTag = true;
    }

    score += bonus - penalty;

    // Вимоги APPROVED тут більше немає. Вона робила метрику залежною від
    // щоденної ручної праці адміна: поки зміни лишались PENDING, надійність
    // у всіх дорівнювала нулю, і доданок reliability у скорингу генератора
    // перетворювався на константу, тобто не працював зовсім.
    const clean = !hasPenaltyTag;
    if (clean) {
      score += this.CLEAN_BONUS;
    }

    return { score, penalty, clean };
  }

  private computeLevel(xp: number): number {
    return Math.min(this.MAX_LEVEL, Math.floor(xp / this.XP_PER_LEVEL) + 1);
  }

  private buildLevel(
    userId: number,
    shifts: EvaluableShift[],
    baseLevel = 1,
  ): EmployeeLevel {
    const stats = {
      approved: 0,
      pending: 0,
      rejected: 0,
      cleanShifts: 0,
      penaltyPoints: 0,
    };
    let rawScore = 0;

    for (const shift of shifts) {
      const { score, penalty, clean } = this.evaluateShift(shift);
      rawScore += score;
      stats.penaltyPoints += penalty;

      if (shift.status === 'APPROVED') {
        stats.approved += 1;
      } else if (shift.status === 'PENDING') {
        stats.pending += 1;
      } else {
        stats.rejected += 1;
      }

      if (clean) {
        stats.cleanShifts += 1;
      }
    }

    // Базовий рівень від адміна — «підлога», поверх якої лягає зароблена історія
    const normalizedBase = Math.min(this.MAX_LEVEL, Math.max(1, baseLevel));
    const baseXp = (normalizedBase - 1) * this.XP_PER_LEVEL;
    const xp = baseXp + Math.max(0, rawScore);
    const totalShifts = shifts.length;
    const reliability =
      totalShifts > 0 ? Math.round((stats.cleanShifts / totalShifts) * 100) : 0;

    return {
      userId,
      level: this.computeLevel(xp),
      baseLevel: normalizedBase,
      xp,
      reliability,
      totalShifts,
      stats,
    };
  }

  private compareLevels(a: EmployeeLevel, b: EmployeeLevel): number {
    return (
      b.level - a.level || b.reliability - a.reliability || b.xp - a.xp
    );
  }

  async getEmployeeLevel(userId: number): Promise<EmployeeLevel> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    const shifts = await this.prisma.workShift.findMany({
      where: { userId },
      include: { tags: true },
    });

    return this.buildLevel(userId, shifts, user.baseLevel ?? 1);
  }

  async getRanking(): Promise<EmployeeLevel[]> {
    const employees = await this.prisma.user.findMany({
      where: { role: Role.Employe },
      select: { id: true, baseLevel: true },
    });

    const levels = await Promise.all(
      employees.map(async (employee) => {
        const shifts = await this.prisma.workShift.findMany({
          where: { userId: employee.id },
          include: { tags: true },
        });
        return this.buildLevel(employee.id, shifts, employee.baseLevel ?? 1);
      }),
    );

    return levels.sort((a, b) => this.compareLevels(a, b));
  }
}
