import { Baby, Dumbbell, Flame, Swords, Users } from 'lucide-react'

/**
 * Ícono de una clase, derivado de su nombre.
 *
 * Antes esto era un emoji (🥋) duplicado en /profile y /asistencia-vivo. El
 * sistema de marca de Kuro no admite emojis: se renderizan distinto en cada
 * sistema operativo, no heredan el color del contenedor y no escalan con el
 * resto de la iconografía. Se reemplazan por lucide, que es la familia que ya
 * usa el resto de la app.
 *
 * El orden de los `includes` importa: "kids" gana sobre "jiu" porque
 * "Jiu-Jitsu Kids" tiene que caer en la infantil, no en la general.
 */
export function ClassIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
    const n = name.toLowerCase()

    if (n.includes('kids') || n.includes('infantil')) return <Baby className={className} />
    if (n.includes('fisico') || n.includes('físico') || n.includes('acondicionamiento')) return <Dumbbell className={className} />
    if (n.includes('mma')) return <Flame className={className} />
    if (n.includes('grappling') || n.includes('lucha')) return <Users className={className} />

    // Jiu-jitsu, judo y todo lo demás: es la mayoría de las clases del sistema.
    return <Swords className={className} />
}
