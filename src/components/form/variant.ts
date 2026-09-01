/**
 * 입력 칸 클래스의 접두사. `rsvp-label` · `gb-label` 처럼 갈린다.
 *
 * global.css 는 두 폼의 선택자를 나란히 적어 **규칙 자체는 하나만** 둔다. 부품도
 * 하나만 두고 접두사만 갈아 끼워, 마크업이 CSS 와 같은 자리에서 갈리게 한다.
 */
export type FormVariant = "rsvp" | "gb";
