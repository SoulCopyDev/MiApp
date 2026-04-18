import React from 'react';
import BaseLevel from '../BaseLevel';

const questions = [
  {
    question: 'Pregunta de ejemplo para Mundo 3 Nivel 4',
    options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
    correct: 0,
    explanation: 'Explicación de ejemplo.'
  }
];

export default function World3Level4() {
  return (
    <BaseLevel
      worldId={3}
      levelId={4}
      levelName="Nivel 4 del Mundo 3"
      questions={questions}
    />
  );
}
